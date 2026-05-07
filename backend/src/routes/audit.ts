import { Hono } from "hono";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";
import { sessionAuth } from "@/middleware/session-auth";
import { config } from "@/config/env";
import type { AppVariables } from "@/types";

export const auditRoute = new Hono<{ Variables: AppVariables }>();
auditRoute.use("*", sessionAuth);

auditRoute.get("/", async (c) => {
	const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10));
	const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10)));
	const offset = (page - 1) * limit;

	const [rows, [{ count }]] = await Promise.all([
		db
			.select()
			.from(auditEvents)
			.orderBy(desc(auditEvents.timestamp))
			.limit(limit)
			.offset(offset),
		db.execute(sql`SELECT COUNT(*)::int AS count FROM audit_events`) as Promise<
			Array<{ count: number }>
		>,
	]);

	return c.json({ items: rows, total: count ?? 0, page, limit });
});

// GET /api/config — returns runtime configuration for the frontend
export const configRoute = new Hono();
configRoute.get("/", (c) => {
	return c.json({ baseUrl: config.PUBLIC_BASE_URL });
});
