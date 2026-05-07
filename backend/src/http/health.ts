import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const VERSION = "0.1.0";

export function createHealthRoute() {
	const route = new Hono();

	route.get("/", async (c) => {
		try {
			await db.execute(sql`SELECT 1`);
			return c.json({ status: "ok", version: VERSION, db: "ok", timestamp: new Date() });
		} catch {
			return c.json(
				{ status: "degraded", version: VERSION, db: "error", timestamp: new Date() },
				503,
			);
		}
	});

	return route;
}
