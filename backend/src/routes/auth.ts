import { Hono } from "hono";
import type { AppVariables } from "@/types";
import { setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { logAuditEvent } from "@/lib/audit";
import { sessionAuth } from "@/middleware/session-auth";

export const authRoute = new Hono<{ Variables: AppVariables }>();

authRoute.post("/login", async (c) => {
	const { email, password } = await c.req.json<{ email: string; password: string }>();

	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (!user) return c.json({ error: "Invalid credentials" }, 401);

	const valid = await verifyPassword(user.passwordHash, password);
	if (!valid) return c.json({ error: "Invalid credentials" }, 401);

	const sessionJwt = await signToken(
		{ sub: user.id, email: user.email, role: user.role },
		"1d",
	);

	setCookie(c, "session", sessionJwt, {
		httpOnly: true,
		secure: false, // TLS terminated by reverse proxy; change to true in production
		sameSite: "Strict",
		maxAge: 86400,
		path: "/",
	});

	await logAuditEvent({ actorEmail: email, action: "login" });

	return c.json({
		user: { id: user.id, email: user.email, role: user.role },
		firstLogin: user.onboardingCompletedAt === null,
	});
});

authRoute.post("/logout", sessionAuth, async (c) => {
	const user = c.get("user");
	deleteCookie(c, "session", { path: "/" });
	await logAuditEvent({ actorEmail: user.email, action: "logout" });
	return c.body(null, 204);
});

authRoute.get("/me", sessionAuth, async (c) => {
	const { email } = c.get("user");
	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (!user) return c.json({ error: "Not found" }, 404);
	return c.json({
		user: { id: user.id, email: user.email, role: user.role },
		firstLogin: user.onboardingCompletedAt === null,
	});
});

authRoute.post("/onboarding-complete", sessionAuth, async (c) => {
	const { email } = c.get("user");
	await db
		.update(users)
		.set({ onboardingCompletedAt: new Date() })
		.where(eq(users.email, email));
	return c.body(null, 204);
});
