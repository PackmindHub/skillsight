import { Hono } from "hono";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { ingestionAuth } from "@/middleware/ingestion-auth";
import { parseOtlpBody, type ParsedEvent } from "@/lib/otlp-parser";

export const telemetryRoute = new Hono();

telemetryRoute.post("/v1/logs", ingestionAuth, async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ partialSuccess: { rejectedLogRecords: 1, errorMessage: "Invalid JSON" } }, 200);
	}

	let parsed: ParsedEvent[];
	try {
		parsed = parseOtlpBody(body);
	} catch (err) {
		return c.json(
			{ partialSuccess: { rejectedLogRecords: 1, errorMessage: String(err) } },
			200,
		);
	}

	if (parsed.length === 0) {
		return c.json({ partialSuccess: {} }, 200);
	}

	await db.insert(events).values(
		parsed.map((e) => ({
			userEmail: e.userEmail,
			sessionId: e.sessionId,
			eventName: e.eventName,
			timestamp: e.timestamp,
			attributes: e.attributes,
		})),
	);

	return c.json({ partialSuccess: {} }, 200);
});
