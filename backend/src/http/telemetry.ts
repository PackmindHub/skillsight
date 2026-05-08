import { Hono } from "hono";
import type { AppDeps } from "@/bootstrap/compose";
import { ingestionAuth } from "@/middleware/ingestion-auth";
import { ingestEvents } from "@/application/telemetry/ingest-events";

export function createTelemetryRoute(deps: Pick<AppDeps, "events" | "marketplaces" | "plugins" | "tokens">) {
	const route = new Hono();

	route.post("/v1/logs", ingestionAuth(deps.tokens), async (c) => {
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json(
				{ partialSuccess: { rejectedLogRecords: 1, errorMessage: "Invalid JSON" } },
				400,
			);
		}

		const result = await ingestEvents(deps, body);

		if (result.rejected) {
			return c.json(
				{ partialSuccess: { rejectedLogRecords: 1, errorMessage: result.error } },
				200,
			);
		}

		return c.json({ partialSuccess: {} }, 200);
	});

	return route;
}
