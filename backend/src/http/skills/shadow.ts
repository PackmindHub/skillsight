import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { getShadowSkills } from "@/application/skills/get-shadow-skills";

export function createShadowRoute(deps: Pick<AppDeps, "skills">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await getShadowSkills(deps));
	});

	return route;
}
