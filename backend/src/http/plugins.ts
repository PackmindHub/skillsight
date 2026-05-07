import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listPlugins } from "@/application/plugins/list-plugins";

export function createPluginsRoute(deps: Pick<AppDeps, "plugins">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json({ plugins: await listPlugins(deps) });
	});

	return route;
}
