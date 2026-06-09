import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "@/bootstrap/compose";
import { deleteSkills, DELETE_SKILLS_MAX_BATCH } from "@/application/skills/delete-skills";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import type { AppVariables } from "@/types";

const deleteSchema = z.object({
	skills: z
		.array(
			z.object({
				skillName: z.string().min(1).max(255),
				pluginName: z.string().max(255),
				marketplaceName: z.string().max(255).optional().default(""),
				skillSource: z.string().max(32).optional().default(""),
			}),
		)
		.min(1)
		.max(DELETE_SKILLS_MAX_BATCH),
});

export function createDeleteRoute(deps: Pick<AppDeps, "skills" | "events" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);
	route.use("*", requireAdmin);

	route.post("/delete", async (c) => {
		const { skills } = deleteSchema.parse(await c.req.json());
		const result = await deleteSkills(deps, {
			entries: skills,
			actorEmail: c.get("user").email,
		});
		if ("error" in result) {
			const message = result.error === "empty" ? "No skills provided" : "Too many skills";
			return c.json({ error: message }, 400);
		}
		return c.json(result);
	});

	return route;
}
