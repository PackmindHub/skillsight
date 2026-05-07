import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";
import type { IntegrationWithSecret } from "@/domain/integration";
import type { NewEvent } from "@/domain/event";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import { parseOtlpBody } from "@/parsers/otlp-parser";

interface SyncDeps {
	integrations: IIntegrationRepository;
	events: IEventRepository;
	loki: ILokiGateway;
}

export async function syncIntegration(
	deps: SyncDeps,
	integration: IntegrationWithSecret,
): Promise<{ syncedAt: Date | null; error: string | null }> {
	const now = new Date();
	const from =
		integration.lastSyncAt ?? new Date(now.getTime() - integration.syncIntervalMs);

	const password =
		integration.authType === "basic" && integration.authPasswordEncrypted
			? decrypt(integration.authPasswordEncrypted)
			: null;

	try {
		const streams = await deps.loki.fetchLogs({
			url: integration.url,
			authType: integration.authType,
			username: integration.authUsername,
			password,
			query: integration.lokiQuery,
			from,
			to: now,
		});

		const parsedEvents = parseStreams(streams, integration.id);

		await deps.events.insertMany(parsedEvents);

		await deps.integrations.updateSyncStatus(integration.id, {
			lastSyncAt: now,
			lastSyncError: null,
		});

		console.log(
			`[loki-sync] ${integration.name}: synced ${parsedEvents.length} events from ${from.toISOString()} to ${now.toISOString()}`,
		);

		return { syncedAt: now, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.integrations.updateSyncStatus(integration.id, { lastSyncError: message });
		console.error(`[loki-sync] ${integration.name}: sync failed — ${message}`);
		return { syncedAt: null, error: message };
	}
}

function parseStreams(streams: LokiStreamResult[], integrationId: string): NewEvent[] {
	const results: NewEvent[] = [];

	for (const { stream, values } of streams) {
		for (const [tsNs, logLine] of values) {
			const timestamp = new Date(Number(BigInt(tsNs) / 1_000_000n));

			let parsed: ReturnType<typeof parseOtlpBody> = [];
			try {
				const json = JSON.parse(logLine) as Record<string, unknown>;
				if (json?.resourceLogs) {
					parsed = parseOtlpBody(json);
				}
			} catch {
				// not JSON or not OTLP — store as raw
			}

			if (parsed.length > 0) {
				results.push(
					...parsed.map((e) => ({
						...e,
						source: "integration" as const,
						sourceIntegrationId: integrationId,
					})),
				);
			} else {
				results.push({
					userEmail: null,
					sessionId: null,
					eventName: "claude_code.loki_raw",
					timestamp,
					attributes: { raw: logLine, labels: stream, integration_id: integrationId },
					source: "integration" as const,
					sourceIntegrationId: integrationId,
				});
			}
		}
	}

	return results;
}
