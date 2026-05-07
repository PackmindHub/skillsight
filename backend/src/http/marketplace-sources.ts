import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listMarketplaceSources } from "@/application/marketplace-sources/list-marketplace-sources";
import { createMarketplaceSource } from "@/application/marketplace-sources/create-marketplace-source";
import { updateMarketplaceSource } from "@/application/marketplace-sources/update-marketplace-source";
import { deleteMarketplaceSource } from "@/application/marketplace-sources/delete-marketplace-source";
import { syncMarketplaceSource } from "@/application/marketplace-sources/sync-marketplace-source";
import {
	scheduleMarketplaceSource,
	rescheduleMarketplaceSource,
	cancelMarketplaceSource,
} from "@/infrastructure/scheduler/marketplace-source-scheduler";

const createSchema = z.object({
	gitUrl: z.string().min(1).max(1000),
	accessToken: z.string().optional().nullable(),
	branch: z.string().max(255).optional().nullable(),
	syncIntervalMs: z.number().int().min(60000).default(3600000),
	enabled: z.boolean().default(true),
	importPluginsAndSkills: z.boolean().default(false),
});

const updateSchema = z.object({
	gitUrl: z.string().min(1).max(1000).optional(),
	accessToken: z.string().optional().nullable(),
	branch: z.string().max(255).optional().nullable(),
	syncIntervalMs: z.number().int().min(60000).optional(),
	enabled: z.boolean().optional(),
	importPluginsAndSkills: z.boolean().optional(),
});

export function createMarketplaceSourcesRoute(
	deps: Pick<AppDeps, "marketplaceSources" | "marketplaces" | "plugins" | "pluginSkills" | "gitMarketplace">,
) {
	const makeSyncDeps = () => ({
		marketplaceSources: deps.marketplaceSources,
		marketplaces: deps.marketplaces,
		plugins: deps.plugins,
		pluginSkills: deps.pluginSkills,
		gitMarketplace: deps.gitMarketplace,
	});

	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await listMarketplaceSources(deps));
	});

	route.post("/", async (c) => {
		const body = createSchema.parse(await c.req.json());
		const source = await createMarketplaceSource(deps, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken ?? undefined,
			branch: body.branch ?? undefined,
			syncIntervalMs: body.syncIntervalMs,
			enabled: body.enabled,
			importPluginsAndSkills: body.importPluginsAndSkills,
		});
		const withSecret = await deps.marketplaceSources.findById(source.id);
		if (withSecret) {
			// trigger an immediate background sync so user sees results quickly
			syncMarketplaceSource(makeSyncDeps(), withSecret).catch(() => {});
			if (source.enabled) scheduleMarketplaceSource(withSecret, (s) => syncMarketplaceSource(makeSyncDeps(), s));
		}
		return c.json(source, 201);
	});

	route.put("/:id", async (c) => {
		const id = c.req.param("id");
		const body = updateSchema.parse(await c.req.json());
		const result = await updateMarketplaceSource(deps, id, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken,
			branch: body.branch ?? undefined,
			syncIntervalMs: body.syncIntervalMs,
			enabled: body.enabled,
			importPluginsAndSkills: body.importPluginsAndSkills,
		});
		if (!result) return c.json({ error: "Not found" }, 404);
		await rescheduleMarketplaceSource(id, deps.marketplaceSources, (s) =>
			syncMarketplaceSource(makeSyncDeps(), s),
		);
		return c.json(result);
	});

	route.delete("/:id", async (c) => {
		const id = c.req.param("id");
		cancelMarketplaceSource(id);
		const deleted = await deleteMarketplaceSource(deps, id);
		if (!deleted) return c.json({ error: "Not found" }, 404);
		return c.body(null, 204);
	});

	route.post("/:id/sync", async (c) => {
		const id = c.req.param("id");
		const source = await deps.marketplaceSources.findById(id);
		if (!source) return c.json({ error: "Not found" }, 404);
		const { syncedAt, pluginCount, skillCount, error } = await syncMarketplaceSource(makeSyncDeps(), source);
		return c.json({
			syncedAt: syncedAt?.toISOString() ?? null,
			pluginCount,
			skillCount,
			error: error ?? null,
		});
	});

	return route;
}
