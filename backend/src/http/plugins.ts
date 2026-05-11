import { Hono } from "hono";
import { z } from "zod";
import { listPluginSkills } from "@/application/plugins/list-plugin-skills";
import { listPlugins } from "@/application/plugins/list-plugins";
import { updatePlugin } from "@/application/plugins/update-plugin";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";

const updateSchema = z.object({
	status: z.enum(["to_review", "approved", "removed"]).optional(),
});

export function createPluginsRoute(deps: Pick<AppDeps, "plugins" | "skills" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json({ plugins: await listPlugins(deps) });
	});

	route.get("/:pluginName/skills", async (c) => {
		const pluginName = decodeURIComponent(c.req.param("pluginName"));
		const data = await listPluginSkills(deps, pluginName);
		return c.json(data);
	});

	route.patch("/:pluginName", async (c) => {
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
