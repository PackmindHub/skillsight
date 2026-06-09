import { Hono } from "hono";
import { z } from "zod";
import { listPluginSkills } from "@/application/plugins/list-plugin-skills";
import { listPlugins } from "@/application/plugins/list-plugins";
import { updatePlugin } from "@/application/plugins/update-plugin";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import type { AppVariables } from "@/types";

const updateSchema = z.object({
	status: z.enum(["to_review", "approved", "removed", "denied", "ignored"]).optional(),
});

export function createPluginsRoute(
	deps: Pick<AppDeps, "plugins" | "pluginVersions" | "skills" | "audit">,
) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const includeIgnored = c.req.query("includeIgnored") === "1";
		return c.json({ plugins: await listPlugins(deps, { includeIgnored }) });
	});

	route.get("/:pluginName/skills", async (c) => {
		const pluginName = decodeURIComponent(c.req.param("pluginName"));
		// `marketplace` is optional; absent / empty string both mean the
		// no-marketplace bucket, which is also valid plugin identity.
		const rawMarketplace = c.req.query("marketplace");
		const marketplaceName =
			rawMarketplace === undefined || rawMarketplace === ""
				? null
				: decodeURIComponent(rawMarketplace);
		// `idHash` identifies a redacted third-party row (pluginName is always the
		// shared 'third-party'); absent for real cataloged plugins.
		const rawIdHash = c.req.query("idHash");
		const pluginIdHash =
			rawIdHash === undefined || rawIdHash === "" ? null : decodeURIComponent(rawIdHash);
		const data = await listPluginSkills(deps, pluginName, marketplaceName, pluginIdHash);
		return c.json(data);
	});

	route.patch("/:pluginName", requireAdmin, async (c) => {
		const pluginName = decodeURIComponent(c.req.param("pluginName"));
		const body = updateSchema.parse(await c.req.json());
		const result = await updatePlugin(
			{ plugins: deps.plugins, skills: deps.skills, audit: deps.audit },
			{ pluginName, ...body, actorEmail: c.get("user").email },
		);
		if ("error" in result) return c.json({ error: "Plugin not found" }, 404);
		return c.json(result);
	});

	return route;
}
