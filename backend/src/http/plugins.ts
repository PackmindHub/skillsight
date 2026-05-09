import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listPlugins } from "@/application/plugins/list-plugins";
import { listPluginSkills } from "@/application/plugins/list-plugin-skills";

export function createPluginsRoute(deps: Pick<AppDeps, "plugins">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json({ plugins: await listPlugins(deps) });
	});

	route.get("/:pluginName/skills", async (c) => {
		const pluginName = decodeURIComponent(c.req.param("pluginName"));
		const skills = await listPluginSkills(deps, pluginName);
		return c.json({ skills });
	});

	return route;
}
