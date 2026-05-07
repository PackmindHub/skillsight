import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "@/config/env";
import { healthRoute } from "@/routes/health";
import { telemetryRoute } from "@/routes/telemetry";
import { authRoute } from "@/routes/auth";
import { tokensRoute } from "@/routes/tokens";
import { usageRoute } from "@/routes/skills/usage";
import { shadowRoute } from "@/routes/skills/shadow";
import { allowedRoute } from "@/routes/skills/allowed";
import { auditRoute, configRoute } from "@/routes/audit";
import { integrationsRoute } from "@/routes/integrations";

const STATIC_ROOT =
	process.env.NODE_ENV === "production"
		? "./public"
		: "../frontend/dist";

export function createApp() {
	const app = new Hono();

	app.use("*", logger());
	app.use("*", secureHeaders());
	app.use(
		"/api/*",
		cors({
			origin: config.PUBLIC_BASE_URL,
			credentials: true,
			allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
		}),
	);

	// API routes (must be before static middleware)
	app.route("/health", healthRoute);
	app.route("/api/v0/telemetry", telemetryRoute);
	app.route("/api/auth", authRoute);
	app.route("/api/tokens", tokensRoute);
	app.route("/api/skills/usage", usageRoute);
	app.route("/api/skills/shadow", shadowRoute);
	app.route("/api/skills/allowed", allowedRoute);
	app.route("/api/audit", auditRoute);
	app.route("/api/config", configRoute);
	app.route("/api/integrations", integrationsRoute);

	// Static files (frontend build)
	app.use("/*", serveStatic({ root: STATIC_ROOT }));
	// SPA fallback — all non-API, non-asset paths return index.html for React Router
	app.use("/*", serveStatic({ path: "index.html", root: STATIC_ROOT }));

	return app;
}
