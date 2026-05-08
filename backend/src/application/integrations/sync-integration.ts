import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";
import type { IntegrationWithSecret } from "@/domain/integration";
import type { NewEvent } from "@/domain/event";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import { parseOtlpBody } from "@/parsers/otlp-parser";

// Must match the limit used in LokiHttpGateway
const LOKI_PAGE_LIMIT = 5000;

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
	const from = integration.lastSyncAt ?? null;

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

		// If we hit the page limit there may be more data behind us; advance to the
		// last received event's timestamp (+1 ms) so the next scheduled run picks up
		// where we left off instead of jumping to now and leaving a gap.
		const hitLimit = streams.reduce((n, s) => n + s.values.length, 0) >= LOKI_PAGE_LIMIT;
		const syncedAt = hitLimit ? lastEventTimestamp(streams) ?? now : now;

		await deps.integrations.updateSyncStatus(integration.id, {
			lastSyncAt: syncedAt,
			lastSyncError: null,
		});

		console.log(
			`[loki-sync] ${integration.name}: synced ${parsedEvents.length} events from ${from?.toISOString() ?? "beginning"} to ${syncedAt.toISOString()}${hitLimit ? " (more pages pending)" : ""}`,
		);

		return { syncedAt, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.integrations.updateSyncStatus(integration.id, { lastSyncError: message });
		console.error(`[loki-sync] ${integration.name}: sync failed — ${message}`);
		return { syncedAt: null, error: message };
	}
}

function lastEventTimestamp(streams: LokiStreamResult[]): Date | null {
	let maxNs = 0n;
	for (const { values } of streams) {
		for (const [tsNs] of values) {
			const ns = BigInt(tsNs);
			if (ns > maxNs) maxNs = ns;
		}
	}
	if (maxNs === 0n) return null;
	// +1 ms so the boundary event is not re-fetched on the next page
	return new Date(Number(maxNs / 1_000_000n) + 1);
}

function parseStreams(streams: LokiStreamResult[], integrationId: string): NewEvent[] {
	const results: NewEvent[] = [];

	for (const { values } of streams) {
		for (const [, logLine] of values) {
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
				const allowed = parsed.filter(
					(e) =>
						e.eventName === "claude_code.skill_activated" ||
						e.eventName === "claude_code.plugin_installed",
				);
				results.push(
					...allowed.map((e) => ({
						...e,
						source: "integration" as const,
						sourceIntegrationId: integrationId,
					})),
				);
			}
		}
	}

	return results;
}
