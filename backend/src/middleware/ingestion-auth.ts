import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { revokedTokens } from "@/db/schema";
import { verifyToken } from "@/lib/jwt";
import type { AppVariables } from "@/types";

export const ingestionAuth = createMiddleware<{
	Variables: AppVariables;
}>(async (c, next) => {
	const authHeader = c.req.header("Authorization");
	if (!authHeader?.startsWith("Bearer ")) return c.json({}, 401);

	const token = authHeader.slice(7);
	let jti: string;
	try {
		const payload = await verifyToken(token);
		if (!payload.jti) return c.json({}, 401);
		jti = payload.jti;
	} catch {
		return c.json({}, 401);
	}

	const revoked = await db
		.select({ jti: revokedTokens.jti })
		.from(revokedTokens)
		.where(eq(revokedTokens.jti, jti))
		.limit(1);

	if (revoked.length > 0) return c.json({}, 401);

	c.set("tokenJti", jti);
	await next();
});
