import { createMiddleware } from "hono/factory";
import type { AppVariables } from "@/types";

export const requireAdmin = createMiddleware<{
	Variables: AppVariables;
}>(async (c, next) => {
	const user = c.get("user");
	if (!user || user.role !== "admin") return c.json({ error: "Forbidden" }, 403);
	await next();
});
