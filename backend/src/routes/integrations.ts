import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { integrations } from "@/db/schema";
import { encrypt } from "@/lib/encrypt";
import { logAuditEvent } from "@/lib/audit";
import { syncIntegration } from "@/lib/loki-sync";
import { rescheduleIntegration, cancelIntegration } from "@/lib/sync-scheduler";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";

export const integrationsRoute = new Hono<{ Variables: AppVariables }>();
integrationsRoute.use("*", sessionAuth);

const createSchema = z.object({
	name: z.string().min(1).max(255),
	url: z.string().url().max(1000),
	authType: z.enum(["none", "basic"]),
	authUsername: z.string().max(255).optional().nullable(),
	authPassword: z.string().optional().nullable(),
	lokiQuery: z.string().max(500).default('{job="claude-code"}'),
	syncIntervalMs: z.number().int().min(5000).default(30000),
	enabled: z.boolean().default(true),
});

const updateSchema = createSchema.partial().omit({ authPassword: true }).extend({
	authPassword: z.string().optional().nullable(),
});

function toClientShape(row: typeof integrations.$inferSelect) {
	const { authPasswordEncrypted: _secret, ...rest } = row;
	return { ...rest, hasPassword: _secret !== null };
}

integrationsRoute.get("/", async (c) => {
	const rows = await db.select().from(integrations).orderBy(integrations.createdAt);
	return c.json(rows.map(toClientShape));
});

integrationsRoute.post("/", async (c) => {
	const body = createSchema.parse(await c.req.json());

	const authPasswordEncrypted =
		body.authType === "basic" && body.authPassword ? encrypt(body.authPassword) : null;

	const [row] = await db
		.insert(integrations)
		.values({
			name: body.name,
			url: body.url,
			authType: body.authType,
			authUsername: body.authUsername ?? null,
			authPasswordEncrypted,
			lokiQuery: body.lokiQuery,
			syncIntervalMs: body.syncIntervalMs,
			enabled: body.enabled,
		})
		.returning();

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "integration_created",
		target: body.name,
	});

	await rescheduleIntegration(row.id);

	return c.json(toClientShape(row), 201);
});

integrationsRoute.put("/:id", async (c) => {
	const id = c.req.param("id");
	const [existing] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
	if (!existing) return c.json({ error: "Not found" }, 404);

	const body = updateSchema.parse(await c.req.json());

	let authPasswordEncrypted = existing.authPasswordEncrypted;
	if (body.authType === "none") {
		authPasswordEncrypted = null;
	} else if (body.authPassword) {
		authPasswordEncrypted = encrypt(body.authPassword);
	}

	const [updated] = await db
		.update(integrations)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.url !== undefined && { url: body.url }),
			...(body.authType !== undefined && { authType: body.authType }),
			...(body.authUsername !== undefined && { authUsername: body.authUsername ?? null }),
			authPasswordEncrypted,
			...(body.lokiQuery !== undefined && { lokiQuery: body.lokiQuery }),
			...(body.syncIntervalMs !== undefined && { syncIntervalMs: body.syncIntervalMs }),
			...(body.enabled !== undefined && { enabled: body.enabled }),
			updatedAt: new Date(),
		})
		.where(eq(integrations.id, id))
		.returning();

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "integration_updated",
		target: updated.name,
	});

	await rescheduleIntegration(id);

	return c.json(toClientShape(updated));
});

integrationsRoute.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const [row] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
	if (!row) return c.json({ error: "Not found" }, 404);

	cancelIntegration(id);
	await db.delete(integrations).where(eq(integrations.id, id));

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "integration_deleted",
		target: row.name,
	});

	return c.body(null, 204);
});

integrationsRoute.post("/:id/sync", async (c) => {
	const id = c.req.param("id");
	const [row] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
	if (!row) return c.json({ error: "Not found" }, 404);

	await syncIntegration(row);

	const [updated] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
	return c.json({
		syncedAt: updated.lastSyncAt?.toISOString() ?? null,
		error: updated.lastSyncError ?? null,
	});
});
