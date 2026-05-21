import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { DEFAULT_LOKI_QUERY } from "@/domain/event";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import { listIntegrations } from "@/application/integrations/list-integrations";
import { createIntegration } from "@/application/integrations/create-integration";
import { updateIntegration } from "@/application/integrations/update-integration";
import { deleteIntegration } from "@/application/integrations/delete-integration";
import { clearIntegrationData } from "@/application/integrations/clear-integration-data";
import { clearDirectData } from "@/application/integrations/clear-direct-data";
import { getDirectStats } from "@/application/integrations/get-direct-stats";
import { syncIntegration } from "@/application/integrations/sync-integration";
import { previewIntegration } from "@/application/integrations/preview-integration";
import { publishIntegrationUpdate } from "@/application/integrations/publish-integration-update";
import { recordAudit } from "@/application/audit/record-audit";
import {
	scheduleIntegration,
	rescheduleIntegration,
	cancelIntegration,
} from "@/infrastructure/scheduler/sync-scheduler";
import {
	eventBus,
	type IntegrationDeletedEvent,
	type IntegrationUpdatedEvent,
} from "@/lib/event-bus";

const createSchema = z.object({
	name: z.string().min(1).max(255),
	url: z.string().url().max(1000),
	authType: z.enum(["none", "basic"]),
	authUsername: z.string().max(255).optional().nullable(),
	authPassword: z.string().optional().nullable(),
	lokiQuery: z.string().max(500).default(DEFAULT_LOKI_QUERY),
	syncIntervalMs: z.number().int().min(5000).default(30000),
	enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({ authPassword: true }).extend({
	authPassword: z.string().optional().nullable(),
});

const previewSchema = z.object({
	url: z.string().url().max(1000),
	authType: z.enum(["none", "basic"]),
	authUsername: z.string().max(255).optional().nullable(),
	authPassword: z.string().optional().nullable(),
	lokiQuery: z.string().max(500),
	integrationId: z.string().uuid().optional().nullable(),
});

export function createIntegrationsRoute(
	deps: Pick<
		AppDeps,
		| "integrations"
		| "events"
		| "skills"
		| "plugins"
		| "pluginSkills"
		| "pluginVersions"
		| "marketplaces"
		| "mappingCache"
		| "loki"
		| "audit"
	>,
) {
	const syncDeps = {
		integrations: deps.integrations,
		events: deps.events,
		skills: deps.skills,
		plugins: deps.plugins,
		pluginSkills: deps.pluginSkills,
		pluginVersions: deps.pluginVersions,
		marketplaces: deps.marketplaces,
		mappingCache: deps.mappingCache,
		loki: deps.loki,
		audit: deps.audit,
	};
	const scheduledSyncFn = (integration: Parameters<typeof scheduleIntegration>[0]) =>
		syncIntegration(syncDeps, integration, { mode: "scheduled" });

	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);
	route.use("*", requireAdmin);

	route.get("/", async (c) => {
		return c.json(await listIntegrations(deps));
	});

	route.get("/stream", (c) => {
		return streamSSE(c, async (stream) => {
			const onUpdate = (payload: IntegrationUpdatedEvent) => {
				if (stream.aborted || stream.closed) return;
				stream
					.writeSSE({
						event: "integration.updated",
						data: JSON.stringify(payload),
					})
					.catch(() => {});
			};
			const onDelete = (payload: IntegrationDeletedEvent) => {
				if (stream.aborted || stream.closed) return;
				stream
					.writeSSE({
						event: "integration.deleted",
						data: JSON.stringify(payload),
					})
					.catch(() => {});
			};

			eventBus.onIntegrationUpdated(onUpdate);
			eventBus.onIntegrationDeleted(onDelete);
			stream.onAbort(() => {
				eventBus.offIntegrationUpdated(onUpdate);
				eventBus.offIntegrationDeleted(onDelete);
			});

			await stream.writeSSE({ event: "ready", data: JSON.stringify({ ts: Date.now() }) });

			while (!stream.aborted) {
				await stream.sleep(25_000);
				if (stream.aborted) break;
				await stream.writeSSE({ event: "heartbeat", data: "" });
			}
		});
	});

	route.get("/direct/stats", async (c) => {
		return c.json(await getDirectStats({ events: deps.events }));
	});

	route.delete("/direct/events", async (c) => {
		await clearDirectData(
			{ events: deps.events, audit: deps.audit },
			{ actorEmail: c.get("user").email },
		);
		return c.body(null, 204);
	});

	route.post("/preview", async (c) => {
		const body = previewSchema.parse(await c.req.json());
		try {
			const results = await previewIntegration(
				{ integrations: deps.integrations, loki: deps.loki },
				body,
			);
			return c.json(results);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const status = message.includes("authentication failed") ? 401 : 400;
			return c.json({ error: message }, status);
		}
	});

	route.post("/", async (c) => {
		const body = createSchema.parse(await c.req.json());
		const actorEmail = c.get("user").email;
		const result = await createIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ ...body, actorEmail },
		);
		const integration = await deps.integrations.findById(result.id);
		if (integration?.enabled) {
			scheduleIntegration(integration, deps.integrations, scheduledSyncFn);
			syncIntegration(syncDeps, integration, {
				mode: "manual",
				actorEmail,
			}).catch(() => {});
		}
		await publishIntegrationUpdate(deps.integrations, result.id);
		return c.json({ ...result, eventCount: 0 }, 201);
	});

	route.put("/:id", async (c) => {
		const id = c.req.param("id");
		const body = updateSchema.parse(await c.req.json());
		const previous = await deps.integrations.findById(id);
		const wasEnabled = previous?.enabled ?? false;
		const result = await updateIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, data: body, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		await rescheduleIntegration(id, deps.integrations, scheduledSyncFn);
		await publishIntegrationUpdate(deps.integrations, id);
		// Match the Resume affordance: if the edit re-enabled a paused integration,
		// kick an immediate sync so the user sees fresh data without waiting for the
		// next interval tick.
		if (!wasEnabled && result.enabled) {
			const fresh = await deps.integrations.findById(id);
			if (fresh?.enabled) {
				await syncIntegration(syncDeps, fresh, {
					mode: "manual",
					actorEmail: c.get("user").email,
				}).catch(() => {});
			}
		}
		return c.json({ ...result, eventCount: 0 });
	});

	route.delete("/:id", async (c) => {
		const id = c.req.param("id");
		cancelIntegration(id);
		const result = await deleteIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, actorEmail: c.get("user").email },
		);
		if (result && "error" in result) return c.json({ error: "Not found" }, 404);
		eventBus.emitIntegrationDeleted({ id });
		return c.body(null, 204);
	});

	route.delete("/:id/data", async (c) => {
		const id = c.req.param("id");
		const result = await clearIntegrationData(
			{ integrations: deps.integrations, events: deps.events, audit: deps.audit },
			{ id, actorEmail: c.get("user").email },
		);
		if (result && "error" in result) return c.json({ error: "Not found" }, 404);
		await publishIntegrationUpdate(deps.integrations, id);
		return c.body(null, 204);
	});

	route.post("/:id/reset-cursor", async (c) => {
		const id = c.req.param("id");
		const integration = await deps.integrations.findById(id);
		if (!integration) return c.json({ error: "Not found" }, 404);
		const previousCursor = integration.lastSyncAt;
		await deps.integrations.updateSyncStatus(id, { lastSyncAt: null, lastSyncError: null });
		await recordAudit(
			{ audit: deps.audit },
			{
				actorEmail: c.get("user").email,
				action: "integration_cursor_reset",
				target: integration.id,
				metadata: {
					name: integration.name,
					previousCursor: previousCursor?.toISOString() ?? null,
				},
			},
		);
		await publishIntegrationUpdate(deps.integrations, id);
		return c.body(null, 204);
	});

	route.post("/:id/sync", async (c) => {
		const id = c.req.param("id");
		const integration = await deps.integrations.findById(id);
		if (!integration) return c.json({ error: "Not found" }, 404);
		if (!integration.enabled) {
			return c.json(
				{ error: "Integration is paused — resume it before syncing." },
				409,
			);
		}
		const { syncedAt, error } = await syncIntegration(syncDeps, integration, {
			mode: "manual",
			actorEmail: c.get("user").email,
		});
		return c.json({
			syncedAt: syncedAt?.toISOString() ?? null,
			error: error ?? null,
		});
	});

	route.post("/:id/pause", async (c) => {
		const id = c.req.param("id");
		const result = await updateIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, data: { enabled: false }, actorEmail: c.get("user").email },
			{ auditAction: "integration_paused" },
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		cancelIntegration(id);
		await publishIntegrationUpdate(deps.integrations, id);
		return c.json({ ...result, eventCount: 0 });
	});

	route.post("/:id/resume", async (c) => {
		const id = c.req.param("id");
		const result = await updateIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, data: { enabled: true }, actorEmail: c.get("user").email },
			{ auditAction: "integration_resumed" },
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		await rescheduleIntegration(id, deps.integrations, scheduledSyncFn);
		await publishIntegrationUpdate(deps.integrations, id);
		const integration = await deps.integrations.findById(id);
		if (integration) {
			await syncIntegration(syncDeps, integration, {
				mode: "manual",
				actorEmail: c.get("user").email,
			}).catch(() => {});
		}
		return c.json({ ...result, eventCount: 0 });
	});

	return route;
}
