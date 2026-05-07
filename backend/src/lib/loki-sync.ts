import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, integrations } from "@/db/schema";
import { decrypt } from "@/lib/encrypt";
import { fetchLokiLogs } from "@/lib/loki-client";
import { parseOtlpBody } from "@/lib/otlp-parser";

type Integration = typeof integrations.$inferSelect;

export async function syncIntegration(integration: Integration): Promise<void> {
	const now = new Date();
	const from = integration.lastSyncAt ?? new Date(now.getTime() - integration.syncIntervalMs);

	const password =
		integration.authType === "basic" && integration.authPasswordEncrypted
			? decrypt(integration.authPasswordEncrypted)
			: null;

	try {
		const streams = await fetchLokiLogs({
			url: integration.url,
			authType: integration.authType as "none" | "basic",
			username: integration.authUsername,
			password,
			query: integration.lokiQuery,
			from,
			to: now,
		});

		const parsedEvents = parseStreams(streams, integration.id);

		if (parsedEvents.length > 0) {
			await db
				.insert(events)
				.values(
					parsedEvents.map((e) => ({
						userEmail: e.userEmail,
						sessionId: e.sessionId,
						eventName: e.eventName,
						timestamp: e.timestamp,
						attributes: e.attributes,
					})),
				)
				.onConflictDoNothing();
		}

		await db
			.update(integrations)
			.set({ lastSyncAt: now, lastSyncError: null, updatedAt: now })
			.where(eq(integrations.id, integration.id));

		console.log(
			`[loki-sync] ${integration.name}: synced ${parsedEvents.length} events from ${from.toISOString()} to ${now.toISOString()}`,
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(integrations)
			.set({ lastSyncError: message, updatedAt: now })
			.where(eq(integrations.id, integration.id));
		console.error(`[loki-sync] ${integration.name}: sync failed — ${message}`);
	}
}

function parseStreams(
	streams: Awaited<ReturnType<typeof fetchLokiLogs>>,
	integrationId: string,
) {
	const results = [];

	for (const { stream, values } of streams) {
		for (const [tsNs, logLine] of values) {
			const timestamp = new Date(Number(BigInt(tsNs) / 1_000_000n));

			let parsed: ReturnType<typeof parseOtlpBody> = [];
			try {
				const json = JSON.parse(logLine);
				if (json?.resourceLogs) {
					parsed = parseOtlpBody(json);
				}
			} catch {
				// not JSON or not OTLP — store as raw
			}

			if (parsed.length > 0) {
				results.push(...parsed);
			} else {
				results.push({
					userEmail: null,
					sessionId: null,
					eventName: "claude_code.loki_raw",
					timestamp,
					attributes: { raw: logLine, labels: stream, integration_id: integrationId },
				});
			}
		}
	}

	return results;
}
