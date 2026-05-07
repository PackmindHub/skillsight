import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "@/config/env";
import { buildDeps } from "@/bootstrap/compose";
import { createHealthRoute } from "@/http/health";
import { createTelemetryRoute } from "@/http/telemetry";
import { createAuthRoute } from "@/http/auth";
import { createTokensRoute } from "@/http/tokens";
import { createUsageRoute } from "@/http/skills/usage";
import { createAuditRoute } from "@/http/audit";
import { createIntegrationsRoute } from "@/http/integrations";
import { createMarketplacesRoute } from "@/http/marketplaces";
import { createPluginsRoute } from "@/http/plugins";
import { createMarketplaceSourcesRoute } from "@/http/marketplace-sources";
import { eventBus } from "@/lib/event-bus";
import { syncPluginStatuses } from "@/application/plugins/sync-plugin-statuses";

const STATIC_ROOT =
	process.env.NODE_ENV === "production"
		? "./public"
		: "../frontend/dist";

export function createApp() {
	const deps = buildDeps();

	eventBus.onMarketplaceStatusChanged(({ name, newStatus }) => {
		syncPluginStatuses(deps, name, newStatus).catch(console.error);
	});

	const app = new Hono();

	app.use("*", logger());
	app.use("*", secureHeaders());
	app.use(
		"/api/*",
		cors({
			origin: config.PUBLIC_BASE_URL,
			credentials: true,
			allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
		}),
	);

	// API routes (must be before static middleware)
	app.route("/health", createHealthRoute());
	app.route("/api/v0/telemetry", createTelemetryRoute(deps));
	app.route("/api/auth", createAuthRoute(deps));
	app.route("/api/tokens", createTokensRoute(deps));
	app.route("/api/skills/usage", createUsageRoute(deps));
	app.route("/api/audit", createAuditRoute(deps));
	app.route("/api/integrations", createIntegrationsRoute(deps));
	app.route("/api/marketplaces", createMarketplacesRoute(deps));
	app.route("/api/plugins", createPluginsRoute(deps));
	app.route("/api/marketplace-sources", createMarketplaceSourcesRoute(deps));
	app.get("/api/config", (c) => c.json({ baseUrl: config.PUBLIC_BASE_URL }));

	// Static files (frontend build)
	app.use("/*", serveStatic({ root: STATIC_ROOT }));
	// SPA fallback — all non-API, non-asset paths return index.html for React Router
	app.use("/*", serveStatic({ path: "index.html", root: STATIC_ROOT }));

	return app;
}
