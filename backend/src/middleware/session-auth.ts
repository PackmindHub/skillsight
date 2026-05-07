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
		c.set("user", {
			id: payload.sub as string,
			email: payload.email as string,
			role: payload.role as string,
		});
		await next();
	} catch {
		return c.json({ error: "Unauthorized" }, 401);
	}
});
