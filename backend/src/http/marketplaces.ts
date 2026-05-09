import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listMarketplaceDetail } from "@/application/marketplaces/list-marketplace-detail";
import { listMarketplaces } from "@/application/marketplaces/list-marketplaces";
import { updateMarketplace } from "@/application/marketplaces/update-marketplace";

const updateSchema = z.object({
	status: z.enum(["to_review", "approved", "denied"]).optional(),
	url: z.string().url().max(1000).nullable().optional(),
	description: z.string().max(2000).nullable().optional(),
});

export function createMarketplacesRoute(deps: Pick<AppDeps, "marketplaces" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json({ marketplaces: await listMarketplaces(deps) });
	});

	route.get("/:name/detail", async (c) => {
		const name = decodeURIComponent(c.req.param("name"));
		const detail = await listMarketplaceDetail({ marketplaces: deps.marketplaces }, name);
		return c.json(detail);
	});

	route.patch("/:name", async (c) => {
		const name = decodeURIComponent(c.req.param("name"));
		const body = updateSchema.parse(await c.req.json());
		const result = await updateMarketplace(
			{ marketplaces: deps.marketplaces, audit: deps.audit },
			{ name, ...body, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Marketplace not found" }, 404);
		return c.json(result);
	});

	return route;
}
