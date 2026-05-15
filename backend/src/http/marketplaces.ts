import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import { deleteMarketplace } from "@/application/marketplaces/delete-marketplace";
import {
	DELETE_MARKETPLACES_MAX_BATCH,
	deleteMarketplaces,
} from "@/application/marketplaces/delete-marketplaces";
import { listMarketplaceDetail } from "@/application/marketplaces/list-marketplace-detail";
import { listMarketplaces } from "@/application/marketplaces/list-marketplaces";
import { updateMarketplace } from "@/application/marketplaces/update-marketplace";
import {
	UPDATE_MARKETPLACES_STATUS_MAX_BATCH,
	updateMarketplacesStatus,
} from "@/application/marketplaces/update-marketplaces-status";
import { cancelMarketplaceSource } from "@/infrastructure/scheduler/marketplace-source-scheduler";

const updateSchema = z.object({
	status: z.enum(["to_review", "approved", "denied", "ignored"]).optional(),
	url: z.string().url().max(1000).nullable().optional(),
	description: z.string().max(2000).nullable().optional(),
});

const deleteModeSchema = z.enum(["orphan", "cascade"]).default("orphan");

const bulkDeleteSchema = z.object({
	names: z.array(z.string().min(1).max(255)).min(1).max(DELETE_MARKETPLACES_MAX_BATCH),
	mode: z.enum(["orphan", "cascade"]).default("orphan"),
	withSources: z.boolean().default(false),
});

const bulkStatusSchema = z.object({
	names: z
		.array(z.string().min(1).max(255))
		.min(1)
		.max(UPDATE_MARKETPLACES_STATUS_MAX_BATCH),
	status: z.enum(["to_review", "approved", "denied", "ignored"]),
});

export function createMarketplacesRoute(
	deps: Pick<
		AppDeps,
		"marketplaces" | "marketplaceSources" | "plugins" | "pluginSkills" | "skills" | "audit"
	>,
) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const includeIgnored = c.req.query("includeIgnored") === "1";
		return c.json({ marketplaces: await listMarketplaces(deps, { includeIgnored }) });
	});

	route.post("/bulk-delete", requireAdmin, async (c) => {
		const body = bulkDeleteSchema.parse(await c.req.json());
		const result = await deleteMarketplaces(deps, {
			names: body.names,
			mode: body.mode,
			withSources: body.withSources,
			actorEmail: c.get("user").email,
		});
		if ("error" in result) {
			const message =
				result.error === "empty" ? "No marketplaces provided" : "Too many marketplaces";
			return c.json({ error: message }, 400);
		}
		for (const sourceId of result.deletedSourceIds) {
			cancelMarketplaceSource(sourceId);
		}
		return c.json(result);
	});

	route.patch("/bulk-status", requireAdmin, async (c) => {
		const body = bulkStatusSchema.parse(await c.req.json());
		const result = await updateMarketplacesStatus(deps, {
			names: body.names,
			status: body.status,
			actorEmail: c.get("user").email,
		});
		if ("error" in result) {
			const message =
				result.error === "empty" ? "No marketplaces provided" : "Too many marketplaces";
			return c.json({ error: message }, 400);
		}
		return c.json(result);
	});

	route.get("/:name/detail", async (c) => {
		const name = decodeURIComponent(c.req.param("name"));
		const detail = await listMarketplaceDetail({ marketplaces: deps.marketplaces }, name);
		return c.json(detail);
	});

	route.patch("/:name", requireAdmin, async (c) => {
		const name = decodeURIComponent(c.req.param("name"));
		const body = updateSchema.parse(await c.req.json());
		const result = await updateMarketplace(
			{ marketplaces: deps.marketplaces, audit: deps.audit },
			{ name, ...body, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Marketplace not found" }, 404);
		return c.json(result);
	});

	route.delete("/:name", requireAdmin, async (c) => {
		const name = decodeURIComponent(c.req.param("name"));
		const mode = deleteModeSchema.parse(c.req.query("mode"));
		const withSources = c.req.query("withSources") === "true";
		const result = await deleteMarketplace(
			deps,
			{ name, mode, withSources },
			{ actorEmail: c.get("user").email },
		);
		if (result.ok) {
			for (const sourceId of result.deletedSourceIds) {
				cancelMarketplaceSource(sourceId);
			}
			return c.body(null, 204);
		}
		if (result.reason === "not_found") return c.json({ error: "Marketplace not found" }, 404);
		return c.json(
			{ error: "Marketplace is still linked to one or more sources", sourceIds: result.sourceIds },
			409,
		);
	});

	return route;
}
