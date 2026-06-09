import { Hono } from "hono";
import { z } from "zod";
import { updateSkillStatus } from "@/application/skills/update-skill-status";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import type { AppVariables } from "@/types";

const updateSchema = z.object({
	skillName: z.string().min(1).max(255),
	pluginName: z.string().max(255),
	marketplaceName: z.string().max(255).optional().default(""),
	skillSource: z.string().max(32).optional().default(""),
	status: z.enum(["to_review", "approved", "removed", "denied", "ignored"]),
});

export function createUpdateStatusRoute(deps: Pick<AppDeps, "skills" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);
	route.use("*", requireAdmin);

	route.patch("/status", async (c) => {
		const body = updateSchema.parse(await c.req.json());
		const result = await updateSkillStatus(deps, {
			...body,
			actorEmail: c.get("user").email,
		});
		if ("error" in result) {
			if (result.error === "not_found") return c.json({ error: "Skill not found" }, 404);
			return c.json({ error: "Status is inherited from plugin" }, 409);
		}
		return c.json(result);
	});

	return route;
}
