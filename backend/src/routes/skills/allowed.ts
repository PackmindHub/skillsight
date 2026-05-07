import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedSkills } from "@/db/schema";
import { sessionAuth } from "@/middleware/session-auth";
import { logAuditEvent } from "@/lib/audit";
import type { AppVariables } from "@/types";

export const allowedRoute = new Hono<{ Variables: AppVariables }>();
allowedRoute.use("*", sessionAuth);

allowedRoute.get("/", async (c) => {
	const rows = await db.select().from(allowedSkills).orderBy(allowedSkills.skillName);
	return c.json(rows);
});

allowedRoute.post("/", async (c) => {
	const { skill_name, source } = await c.req.json<{ skill_name: string; source?: string }>();
	if (!skill_name?.trim()) return c.json({ error: "skill_name is required" }, 400);

	const [row] = await db
		.insert(allowedSkills)
		.values({
			skillName: skill_name.trim(),
			source: source ?? "manual",
			addedBy: c.get("user").email,
		})
		.onConflictDoNothing()
		.returning();

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "allowlist_added",
		target: skill_name.trim(),
	});

	return c.json(row ?? { skillName: skill_name.trim() }, 201);
});

allowedRoute.delete("/:name", async (c) => {
	const name = c.req.param("name");
	const [deleted] = await db
		.delete(allowedSkills)
		.where(eq(allowedSkills.skillName, name))
		.returning();

	if (!deleted) return c.json({ error: "Not found" }, 404);

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "allowlist_removed",
		target: name,
	});

	return c.body(null, 204);
});
