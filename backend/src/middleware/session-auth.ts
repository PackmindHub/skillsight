import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyToken } from "@/infrastructure/crypto/jwt";
import type { AppVariables } from "@/types";

export const sessionAuth = createMiddleware<{
	Variables: AppVariables;
}>(async (c, next) => {
	const token = getCookie(c, "session");
	if (!token) return c.json({ error: "Unauthorized" }, 401);
	try {
		const payload = await verifyToken(token);
		// Reject anything that isn't a session token (notably: ingestion JWTs,
		// which are signed with the same secret). Without this check, an
		// ingestion token pasted into the `session` cookie would pass.
		if (payload.type !== "session") return c.json({ error: "Unauthorized" }, 401);
		const sub = payload.sub;
		const email = payload.email;
		const role = payload.role;
		if (typeof sub !== "string" || !sub) return c.json({ error: "Unauthorized" }, 401);
		if (typeof email !== "string" || !email) return c.json({ error: "Unauthorized" }, 401);
		if (typeof role !== "string" || !role) return c.json({ error: "Unauthorized" }, 401);
		c.set("user", { id: sub, email, role });
		await next();
	} catch {
		return c.json({ error: "Unauthorized" }, 401);
	}
});
