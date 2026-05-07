import { Hono } from "hono";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";
import { getShadowSkills } from "@/queries/skills-shadow";

export const shadowRoute = new Hono<{ Variables: AppVariables }>();
shadowRoute.use("*", sessionAuth);

shadowRoute.get("/", async (c) => {
	const rows = await getShadowSkills();
	return c.json(rows);
});
