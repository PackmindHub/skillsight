import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { login } from "@/application/auth/login";
import { getCurrentUser } from "@/application/auth/get-current-user";
import { completeOnboarding } from "@/application/auth/complete-onboarding";
import { isHttps } from "@/lib/request-url";

export function createAuthRoute(deps: Pick<AppDeps, "users" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();

	route.post("/login", async (c) => {
		const { email, password } = await c.req.json<{ email: string; password: string }>();
		const result = await login(deps, { email, password });

		if ("error" in result) return c.json({ error: "Invalid credentials" }, 401);

		setCookie(c, "session", result.sessionJwt, {
			httpOnly: true,
			secure: isHttps(c),
			sameSite: "Strict",
			maxAge: 86400,
			path: "/",
		});

		return c.json({
			user: { id: result.user.id, email: result.user.email, role: result.user.role },
			firstLogin: result.user.onboardingCompletedAt === null,
		});
	});

	route.post("/logout", sessionAuth, async (c) => {
		const { email } = c.get("user");
		deleteCookie(c, "session", { path: "/" });
		await deps.audit.log({ actorEmail: email, action: "logout" });
		return c.body(null, 204);
	});

	route.get("/me", sessionAuth, async (c) => {
		const { email } = c.get("user");
		const user = await getCurrentUser(deps, email);
		if (!user) return c.json({ error: "Not found" }, 404);
		return c.json({
			user: { id: user.id, email: user.email, role: user.role },
			firstLogin: user.onboardingCompletedAt === null,
		});
	});

	route.post("/onboarding-complete", sessionAuth, async (c) => {
		const { email } = c.get("user");
		await completeOnboarding(deps, email);
		return c.body(null, 204);
	});

	return route;
}
