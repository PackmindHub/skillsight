import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listAllowedSkills } from "@/application/skills/list-allowed-skills";
import { addAllowedSkill } from "@/application/skills/add-allowed-skill";
import { removeAllowedSkill } from "@/application/skills/remove-allowed-skill";

export function createAllowedRoute(deps: Pick<AppDeps, "skills" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		return c.json(await listAllowedSkills(deps));
	});

	route.post("/", async (c) => {
		const { skill_name, source } = await c.req.json<{ skill_name: string; source?: string }>();
		if (!skill_name?.trim()) return c.json({ error: "skill_name is required" }, 400);
		const result = await addAllowedSkill(deps, {
			skillName: skill_name.trim(),
			source,
			actorEmail: c.get("user").email,
		});
		return c.json(result, 201);
	});

	route.delete("/:name", async (c) => {
		const result = await removeAllowedSkill(deps, {
			skillName: c.req.param("name"),
			actorEmail: c.get("user").email,
		});
		if ("error" in result) return c.json({ error: "Not found" }, 404);
		return c.body(null, 204);
	});

	return route;
}
