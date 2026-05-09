import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listIntegrations } from "@/application/integrations/list-integrations";
import { createIntegration } from "@/application/integrations/create-integration";
import { updateIntegration } from "@/application/integrations/update-integration";
import { deleteIntegration } from "@/application/integrations/delete-integration";
import { clearIntegrationData } from "@/application/integrations/clear-integration-data";
import { syncIntegration } from "@/application/integrations/sync-integration";
import { previewIntegration } from "@/application/integrations/preview-integration";
import {
	scheduleIntegration,
	rescheduleIntegration,
	cancelIntegration,
} from "@/infrastructure/scheduler/sync-scheduler";

const createSchema = z.object({
	name: z.string().min(1).max(255),
	url: z.string().url().max(1000),
	authType: z.enum(["none", "basic"]),
	authUsername: z.string().max(255).optional().nullable(),
	authPassword: z.string().optional().nullable(),
	lokiQuery: z.string().max(500).default('{service_name="claude-code"} | event_name=~`skill_activated|plugin_installed`'),
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
	deps: Pick<AppDeps, "integrations" | "events" | "skills" | "loki" | "audit">,
) {
	const syncDeps = {
		integrations: deps.integrations,
		events: deps.events,
		skills: deps.skills,
		loki: deps.loki,
	};
	const makeSyncFn = (integration: Parameters<typeof scheduleIntegration>[0]) =>
		syncIntegration(syncDeps, integration);

	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await listIntegrations(deps));
	});

	route.post("/preview", async (c) => {
		const body = previewSchema.parse(await c.req.json());
		const results = await previewIntegration(
			{ integrations: deps.integrations, loki: deps.loki },
			body,
		);
		return c.json(results);
	});

	route.post("/", async (c) => {
		const body = createSchema.parse(await c.req.json());
		const result = await createIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ ...body, actorEmail: c.get("user").email },
		);
		const integration = await deps.integrations.findById(result.id);
		if (integration) scheduleIntegration(integration, makeSyncFn);
		return c.json({ ...result, eventCount: 0 }, 201);
	});

	route.put("/:id", async (c) => {
		const id = c.req.param("id");
		const body = updateSchema.parse(await c.req.json());
		const result = await updateIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, data: body, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		await rescheduleIntegration(id, deps.integrations, makeSyncFn);
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
		return c.body(null, 204);
	});

	route.delete("/:id/data", async (c) => {
		const id = c.req.param("id");
		const result = await clearIntegrationData(
			{ integrations: deps.integrations, events: deps.events, audit: deps.audit },
			{ id, actorEmail: c.get("user").email },
		);
		if (result && "error" in result) return c.json({ error: "Not found" }, 404);
		return c.body(null, 204);
	});

	route.post("/:id/reset-cursor", async (c) => {
		const id = c.req.param("id");
		const integration = await deps.integrations.findById(id);
		if (!integration) return c.json({ error: "Not found" }, 404);
		await deps.integrations.updateSyncStatus(id, { lastSyncAt: null, lastSyncError: null });
		return c.body(null, 204);
	});

	route.post("/:id/sync", async (c) => {
		const id = c.req.param("id");
		const integration = await deps.integrations.findById(id);
		if (!integration) return c.json({ error: "Not found" }, 404);
		const { syncedAt, error } = await syncIntegration(syncDeps, integration);
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
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		cancelIntegration(id);
		return c.json({ ...result, eventCount: 0 });
	});

	route.post("/:id/resume", async (c) => {
		const id = c.req.param("id");
		const result = await updateIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ id, data: { enabled: true }, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		await rescheduleIntegration(id, deps.integrations, makeSyncFn);
		const integration = await deps.integrations.findById(id);
		if (integration) {
			await syncIntegration(syncDeps, integration).catch(() => {});
		}
		return c.json({ ...result, eventCount: 0 });
	});

	return route;
}
