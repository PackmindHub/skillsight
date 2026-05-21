import "@/config/env"; // Validate env first — will exit(1) if invalid
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { serve } from "@hono/node-server";
import { db } from "@/db/client";
import { seedAdmin } from "@/bootstrap/seed-admin";
import { backfillLokiQueries } from "@/bootstrap/backfill-loki-queries";
import { buildDeps } from "@/bootstrap/compose";
import { createApp } from "@/app";
import { config } from "@/config/env";
import { startScheduler } from "@/infrastructure/scheduler/sync-scheduler";
import { syncIntegration } from "@/application/integrations/sync-integration";
import { startMarketplaceSourceScheduler } from "@/infrastructure/scheduler/marketplace-source-scheduler";
import { syncMarketplaceSource } from "@/application/marketplace-sources/sync-marketplace-source";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	console.log("[startup] Running migrations...");
	await migrate(db, {
		migrationsFolder: path.join(__dirname, "db/migrations"),
	});
	console.log("[startup] Migrations complete.");

	await seedAdmin();
	await backfillLokiQueries();

	const app = createApp();
	serve({ fetch: app.fetch, port: config.PORT, hostname: "0.0.0.0" }, async (info) => {
		console.log(`[server] Listening on 0.0.0.0:${info.port}`);
		const deps = buildDeps();
		await deps.mappingCache.load();
		console.log(`[startup] Loaded ${deps.mappingCache.size()} external skill mapping(s).`);
		await startScheduler(deps.integrations, (integration) =>
			syncIntegration(
				{
					integrations: deps.integrations,
					events: deps.events,
					skills: deps.skills,
					plugins: deps.plugins,
					pluginSkills: deps.pluginSkills,
					pluginVersions: deps.pluginVersions,
					marketplaces: deps.marketplaces,
					mappingCache: deps.mappingCache,
					loki: deps.loki,
					audit: deps.audit,
				},
				integration,
				{ mode: "scheduled" },
			),
		);
		await startMarketplaceSourceScheduler(deps.marketplaceSources, (source) =>
			syncMarketplaceSource(
				{
					marketplaceSources: deps.marketplaceSources,
					marketplaces: deps.marketplaces,
					plugins: deps.plugins,
					pluginSkills: deps.pluginSkills,
					pluginVersions: deps.pluginVersions,
					skills: deps.skills,
					gitMarketplace: deps.gitMarketplace,
					packmindCli: deps.packmindCli,
					externalSkillMappings: deps.externalSkillMappings,
					mappingCache: deps.mappingCache,
					audit: deps.audit,
				},
				source,
				{ mode: "scheduled" },
			),
		);
	});
}

main().catch((err) => {
	console.error("[fatal]", err);
	process.exit(1);
});
