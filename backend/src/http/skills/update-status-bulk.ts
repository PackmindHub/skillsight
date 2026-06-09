import { Hono } from "hono";
import { z } from "zod";
import {
	UPDATE_SKILLS_STATUS_MAX_BATCH,
	updateSkillsStatus,
} from "@/application/skills/update-skills-status";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import type { AppVariables } from "@/types";

const bulkSchema = z.object({
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
		.max(UPDATE_SKILLS_STATUS_MAX_BATCH),
	status: z.enum(["to_review", "approved", "removed", "denied", "ignored"]),
});

export function createUpdateStatusBulkRoute(deps: Pick<AppDeps, "skills" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);
	route.use("*", requireAdmin);

	route.patch("/status/bulk", async (c) => {
		const body = bulkSchema.parse(await c.req.json());
		const result = await updateSkillsStatus(deps, {
			entries: body.skills,
			status: body.status,
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
