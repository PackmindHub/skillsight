import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tokens, revokedTokens } from "@/db/schema";
import { createIngestionToken, extractJti } from "@/lib/jwt";
import { logAuditEvent } from "@/lib/audit";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";

export const tokensRoute = new Hono<{ Variables: AppVariables }>();
tokensRoute.use("*", sessionAuth);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

tokensRoute.get("/", async (c) => {
	const rows = await db.select().from(tokens).orderBy(tokens.createdAt);
	const now = new Date();
	return c.json(
		rows.map((t) => ({
			...t,
			expiresSoon:
				t.expiresAt !== null &&
				t.revokedAt === null &&
				t.expiresAt.getTime() - now.getTime() < SEVEN_DAYS_MS &&
				t.expiresAt > now,
		})),
	);
});

tokensRoute.post("/", async (c) => {
	const { name, userLabel, expiresAt: expiresAtStr } = await c.req.json<{
		name: string;
		userLabel?: string;
		expiresAt?: string;
	}>();

	const expiresAt = expiresAtStr ? new Date(expiresAtStr) : undefined;
	const jwt = await createIngestionToken(name, userLabel, expiresAt);
	const jti = extractJti(jwt);
	if (!jti) throw new Error("Failed to extract jti from generated token");

	const [token] = await db
		.insert(tokens)
		.values({ jti, name, userLabel, expiresAt: expiresAt ?? null })
		.returning();

	await logAuditEvent({ actorEmail: c.get("user").email, action: "token_created", target: name });

	return c.json({ ...token, jwt }, 201);
});

tokensRoute.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const [token] = await db.select().from(tokens).where(eq(tokens.id, id)).limit(1);
	if (!token) return c.json({ error: "Not found" }, 404);
	if (token.revokedAt) return c.json({ error: "Already revoked" }, 409);

	await db.insert(revokedTokens).values({ jti: token.jti }).onConflictDoNothing();
	await db.update(tokens).set({ revokedAt: new Date() }).where(eq(tokens.id, id));

	await logAuditEvent({
		actorEmail: c.get("user").email,
		action: "token_revoked",
		target: token.name,
	});

	return c.body(null, 204);
});
