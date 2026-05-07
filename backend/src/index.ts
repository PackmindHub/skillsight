import "@/config/env"; // Validate env first — will exit(1) if invalid
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { serve } from "@hono/node-server";
import { db } from "@/db/client";
import { seedAdmin } from "@/bootstrap/seed-admin";
import { createApp } from "@/app";
import { config } from "@/config/env";
import { startScheduler } from "@/lib/sync-scheduler";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	console.log("[startup] Running migrations...");
	// In dev: __dirname = src/, migrations at src/db/migrations
	// In Docker: __dirname = dist/server/, migrations copied to dist/server/db/migrations
	await migrate(db, {
		migrationsFolder: path.join(__dirname, "db/migrations"),
	});
	console.log("[startup] Migrations complete.");

	await seedAdmin();

	const app = createApp();
	serve({ fetch: app.fetch, port: config.PORT, hostname: "0.0.0.0" }, async (info) => {
		console.log(`[server] Listening on http://localhost:${info.port}`);
		await startScheduler();
	});
}

main().catch((err) => {
	console.error("[fatal]", err);
	process.exit(1);
});
