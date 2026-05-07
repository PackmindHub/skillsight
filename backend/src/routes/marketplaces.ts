import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { marketplaces } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";

export const marketplacesRoute = new Hono<{ Variables: AppVariables }>();
marketplacesRoute.use("*", sessionAuth);

marketplacesRoute.get("/", async (c) => {
	const rows = await db.execute(sql`
		SELECT
		  m.name,
		  m.status,
		  m.url,
		  m.description,
		  m.first_seen_at AS "firstSeenAt",
		  m.last_seen_at AS "lastSeenAt",
		  COALESCE(stats.count, 0)::int AS "activationCount"
		FROM marketplaces m
		LEFT JOIN (
		  SELECT attributes->>'marketplace.name' AS mp_name, COUNT(*)::int AS count
		  FROM events
		  WHERE event_name = 'claude_code.skill_activated'
		    AND timestamp >= NOW() - INTERVAL '30 days'
		    AND attributes->>'marketplace.name' IS NOT NULL
		  GROUP BY mp_name
		) stats ON stats.mp_name = m.name
		ORDER BY "activationCount" DESC, m.name
	`);
	return c.json({ marketplaces: rows });
});

const updateSchema = z.object({
	status: z.enum(["to_review", "approved", "denied"]).optional(),
	url: z.string().url().max(1000).nullable().optional(),
	description: z.string().max(2000).nullable().optional(),
});

marketplacesRoute.patch("/:name", async (c) => {
	const name = decodeURIComponent(c.req.param("name"));
	const body = updateSchema.parse(await c.req.json());

	const [existing] = await db
		.select()
		.from(marketplaces)
		.where(eq(marketplaces.name, name));

	if (!existing) {
		return c.json({ error: "Marketplace not found" }, 404);
	}

	const updates: Partial<typeof marketplaces.$inferInsert> = {};
	if (body.status !== undefined) updates.status = body.status;
	if (body.url !== undefined) updates.url = body.url;
	if (body.description !== undefined) updates.description = body.description;

	const [updated] = await db
		.update(marketplaces)
		.set(updates)
		.where(eq(marketplaces.name, name))
		.returning();

	const actor = c.get("user").email as string | null;

	if (body.status !== undefined && body.status !== existing.status) {
		await logAuditEvent({
			actorEmail: actor,
			action: "marketplace_status_changed",
			target: name,
			metadata: { from: existing.status, to: body.status },
		});
	} else if (Object.keys(updates).length > 0) {
		await logAuditEvent({
			actorEmail: actor,
			action: "marketplace_updated",
			target: name,
			metadata: updates as Record<string, unknown>,
		});
	}

	return c.json(updated);
});
