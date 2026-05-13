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
import { testMarketplaceSourceConnection } from "@/application/marketplace-sources/test-marketplace-source-connection";
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

const testConnectionSchema = z.object({
	gitUrl: z.string().min(1).max(1000),
	accessToken: z.string().nullable().optional(),
	branch: z.string().max(255).nullable().optional(),
	sourceId: z.string().uuid().nullable().optional(),
});

export function createMarketplaceSourcesRoute(
	deps: Pick<
		AppDeps,
		| "marketplaceSources"
		| "marketplaces"
		| "plugins"
		| "pluginSkills"
		| "pluginVersions"
		| "skills"
		| "gitMarketplace"
		| "audit"
	>,
) {
	const makeSyncDeps = () => ({
		marketplaceSources: deps.marketplaceSources,
		marketplaces: deps.marketplaces,
		plugins: deps.plugins,
		pluginSkills: deps.pluginSkills,
		pluginVersions: deps.pluginVersions,
		skills: deps.skills,
		gitMarketplace: deps.gitMarketplace,
		audit: deps.audit,
	});

	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await listMarketplaceSources(deps));
	});

	route.post("/test-connection", async (c) => {
		const body = testConnectionSchema.parse(await c.req.json());
		const result = await testMarketplaceSourceConnection(deps, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken ?? null,
			branch: body.branch ?? null,
			sourceId: body.sourceId ?? null,
		});
		return c.json(result);
	});

	route.post("/", async (c) => {
		const body = createSchema.parse(await c.req.json());
		const test = await testMarketplaceSourceConnection(deps, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken ?? null,
			branch: body.branch ?? null,
		});
		if (!test.ok) return c.json({ error: test.error }, 400);
		const actorEmail = c.get("user").email;
		const source = await createMarketplaceSource(deps, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken ?? undefined,
			branch: body.branch ?? undefined,
			syncIntervalMs: body.syncIntervalMs,
			enabled: body.enabled,
			importPluginsAndSkills: body.importPluginsAndSkills,
			actorEmail,
		});
		const withSecret = await deps.marketplaceSources.findById(source.id);
		let firstSync: { pluginCount: number; skillCount: number; error: string | null } | null = null;
		if (withSecret) {
			const result = await syncMarketplaceSource(makeSyncDeps(), withSecret, {
				actorEmail,
				mode: "manual",
			});
			firstSync = {
				pluginCount: result.pluginCount,
				skillCount: result.skillCount,
				error: result.error,
			};
			if (source.enabled)
				scheduleMarketplaceSource(withSecret, (s) =>
					syncMarketplaceSource(makeSyncDeps(), s, { mode: "scheduled" }),
				);
		}
		const refreshedWithSecret = await deps.marketplaceSources.findById(source.id);
		const refreshed = refreshedWithSecret
			? (() => {
					const { accessTokenEncrypted: _t, ...rest } = refreshedWithSecret;
					return rest;
				})()
			: source;
		return c.json({ ...refreshed, firstSync }, 201);
	});

	route.put("/:id", async (c) => {
		const id = c.req.param("id");
		const body = updateSchema.parse(await c.req.json());
		const existing = await deps.marketplaceSources.findById(id);
		if (!existing) return c.json({ error: "Not found" }, 404);
		const test = await testMarketplaceSourceConnection(deps, {
			gitUrl: body.gitUrl ?? existing.gitUrl,
			accessToken: body.accessToken ?? null,
			branch: body.branch !== undefined ? body.branch : existing.branch,
			sourceId: id,
		});
		if (!test.ok) return c.json({ error: test.error }, 400);
		const result = await updateMarketplaceSource(deps, id, {
			gitUrl: body.gitUrl,
			accessToken: body.accessToken,
			branch: body.branch ?? undefined,
			syncIntervalMs: body.syncIntervalMs,
			enabled: body.enabled,
			importPluginsAndSkills: body.importPluginsAndSkills,
			actorEmail: c.get("user").email,
		});
		if (!result) return c.json({ error: "Not found" }, 404);
		await rescheduleMarketplaceSource(id, deps.marketplaceSources, (s) =>
			syncMarketplaceSource(makeSyncDeps(), s, { mode: "scheduled" }),
		);
		return c.json(result);
	});

	route.delete("/:id", async (c) => {
		const id = c.req.param("id");
		cancelMarketplaceSource(id);
		const deleted = await deleteMarketplaceSource(deps, id, { actorEmail: c.get("user").email });
		if (!deleted) return c.json({ error: "Not found" }, 404);
		return c.body(null, 204);
	});

	route.post("/:id/sync", async (c) => {
		const id = c.req.param("id");
		const source = await deps.marketplaceSources.findById(id);
		if (!source) return c.json({ error: "Not found" }, 404);
		const { syncedAt, pluginCount, skillCount, error } = await syncMarketplaceSource(
			makeSyncDeps(),
			source,
			{ mode: "manual", actorEmail: c.get("user").email },
		);
		return c.json({
			syncedAt: syncedAt?.toISOString() ?? null,
			pluginCount,
			skillCount,
			error: error ?? null,
		});
	});

	route.post("/:id/pause", async (c) => {
		const id = c.req.param("id");
		const result = await updateMarketplaceSource(
			deps,
			id,
			{ enabled: false, actorEmail: c.get("user").email },
			{ auditAction: "marketplace_source_paused" },
		);
		if (!result) return c.json({ error: "Not found" }, 404);
		cancelMarketplaceSource(id);
		return c.json(result);
	});

	route.post("/:id/resume", async (c) => {
		const id = c.req.param("id");
		const result = await updateMarketplaceSource(
			deps,
			id,
			{ enabled: true, actorEmail: c.get("user").email },
			{ auditAction: "marketplace_source_resumed" },
		);
		if (!result) return c.json({ error: "Not found" }, 404);
		await rescheduleMarketplaceSource(id, deps.marketplaceSources, (s) =>
			syncMarketplaceSource(makeSyncDeps(), s, { mode: "scheduled" }),
		);
		const refreshed = await deps.marketplaceSources.findById(id);
		if (refreshed) {
			syncMarketplaceSource(makeSyncDeps(), refreshed, {
				mode: "manual",
				actorEmail: c.get("user").email,
			}).catch(() => {});
		}
		return c.json(result);
	});

	return route;
}
