import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listIntegrations } from "@/application/integrations/list-integrations";
import { createIntegration } from "@/application/integrations/create-integration";
import { updateIntegration } from "@/application/integrations/update-integration";
import { deleteIntegration } from "@/application/integrations/delete-integration";
import { syncIntegration } from "@/application/integrations/sync-integration";
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
	lokiQuery: z.string().max(500).default('{job="claude-code"}'),
	syncIntervalMs: z.number().int().min(5000).default(30000),
	enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({ authPassword: true }).extend({
	authPassword: z.string().optional().nullable(),
});

export function createIntegrationsRoute(
	deps: Pick<AppDeps, "integrations" | "events" | "loki" | "audit">,
) {
	const syncDeps = { integrations: deps.integrations, events: deps.events, loki: deps.loki };
	const makeSyncFn = (integration: Parameters<typeof scheduleIntegration>[0]) =>
		syncIntegration(syncDeps, integration);

	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await listIntegrations(deps));
	});

	route.post("/", async (c) => {
		const body = createSchema.parse(await c.req.json());
		const result = await createIntegration(
			{ integrations: deps.integrations, audit: deps.audit },
			{ ...body, actorEmail: c.get("user").email },
		);
		const integration = await deps.integrations.findById(result.id);
		if (integration) scheduleIntegration(integration, makeSyncFn);
		return c.json(result, 201);
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
		return c.json(result);
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

	return route;
}
