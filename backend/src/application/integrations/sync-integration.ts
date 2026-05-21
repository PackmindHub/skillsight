import { recordAudit } from "@/application/audit/record-audit";
import type { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import { resolveSkillContext } from "@/application/external-skill-mappings/resolve-skill-context";
import { publishIntegrationUpdate } from "@/application/integrations/publish-integration-update";
import { EVENT_NAMES, type NewEvent } from "@/domain/event";
import type { IntegrationWithSecret } from "@/domain/integration";
import {
	computePluginStatus,
	normalizeMarketplaceName,
	type PluginVersionSeen,
} from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import { eventBus } from "@/lib/event-bus";
import { parseLokiStreams } from "@/parsers/loki-stream-parser";

// Must match the limit used in LokiHttpGateway
const LOKI_PAGE_LIMIT = 5000;

interface SyncDeps {
	integrations: IIntegrationRepository;
	events: IEventRepository;
	skills: ISkillRepository;
	plugins: IPluginRepository;
	pluginSkills: IPluginSkillRepository;
	pluginVersions: IPluginVersionRepository;
	marketplaces: IMarketplaceRepository;
	mappingCache: ExternalSkillMappingCache;
	loki: ILokiGateway;
	audit: IAuditRepository;
}

export interface SyncIntegrationOptions {
	mode?: "manual" | "scheduled";
	actorEmail?: string | null;
}

export async function syncIntegration(
	deps: SyncDeps,
	integration: IntegrationWithSecret,
	options: SyncIntegrationOptions = {},
): Promise<{ syncedAt: Date | null; error: string | null }> {
	const now = new Date();
	const from = integration.lastSyncAt ?? null;
	const mode = options.mode ?? "scheduled";
	const actorEmail = options.actorEmail ?? null;
	const startedAt = Date.now();

	if (mode === "manual") {
		await recordAudit(deps, {
			actorEmail,
			action: "integration_sync_triggered",
			target: integration.id,
			metadata: { mode, name: integration.name, from: from?.toISOString() ?? null },
		});
	}

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

		const resolveCtx = (skillName: string, attrs: Record<string, unknown>) =>
			resolveSkillContext(
				deps.mappingCache,
				skillName,
				attrs["plugin.name"],
				attrs["marketplace.name"],
			);

		for (const e of parsedEvents) {
			if (e.eventName !== EVENT_NAMES.SKILL_ACTIVATED) continue;
			const skillName = e.attributes["skill.name"];
			if (typeof skillName !== "string") continue;
			const ctx = resolveCtx(skillName, e.attributes);
			eventBus.emitSkillActivated({
				id: `${e.timestamp.getTime()}_${skillName}_${e.sessionId ?? ""}_${e.userEmail ?? ""}`,
				timestamp: e.timestamp.toISOString(),
				userEmail: e.userEmail,
				sessionId: e.sessionId,
				skillName,
				pluginName: ctx.pluginName,
				marketplaceName: ctx.marketplaceName,
				trigger:
					typeof e.attributes.invocation_trigger === "string"
						? (e.attributes.invocation_trigger as string)
						: null,
			});
		}

		const skillEntries = parsedEvents
			.filter(
				(e) =>
					e.eventName === EVENT_NAMES.SKILL_ACTIVATED &&
					typeof e.attributes["skill.name"] === "string",
			)
			.map((e) => {
				const skillName = e.attributes["skill.name"] as string;
				const ctx = resolveCtx(skillName, e.attributes);
				return { skillName, pluginName: ctx.pluginName };
			});
		if (skillEntries.length > 0) {
			await deps.skills.upsertMany(skillEntries);
		}

		const mpNames = [
			...new Set(
				parsedEvents
					.filter((e) => e.eventName === EVENT_NAMES.SKILL_ACTIVATED)
					.flatMap((e) => {
						const skillName = e.attributes["skill.name"];
						if (typeof skillName !== "string") return [];
						const ctx = resolveCtx(skillName, e.attributes);
						return ctx.marketplaceName ? [ctx.marketplaceName] : [];
					}),
			),
		];
		if (mpNames.length > 0) {
			await deps.marketplaces.upsertSeen(mpNames);
		}

		const skillActivationsWithPlugin = parsedEvents.flatMap((e) => {
			if (e.eventName !== EVENT_NAMES.SKILL_ACTIVATED) return [];
			const skillName = e.attributes["skill.name"];
			if (typeof skillName !== "string") return [];
			const ctx = resolveCtx(skillName, e.attributes);
			if (!ctx.pluginName) return [];
			return [{ skillName, pluginName: ctx.pluginName, marketplaceName: ctx.marketplaceName }];
		});

		if (skillActivationsWithPlugin.length > 0) {
			const statusMap = Object.fromEntries(
				(await deps.marketplaces.listStatuses()).map((m) => [m.name, m.status]),
			);

			const seenPlugins = new Set<string>();
			const pluginSkillPairs: Array<{ pluginName: string; skillName: string }> = [];

			for (const entry of skillActivationsWithPlugin) {
				pluginSkillPairs.push({ pluginName: entry.pluginName, skillName: entry.skillName });

				if (seenPlugins.has(entry.pluginName)) continue;
				seenPlugins.add(entry.pluginName);

				const status = computePluginStatus(
					entry.marketplaceName,
					entry.marketplaceName ? statusMap[entry.marketplaceName] : null,
				);

				await deps.plugins.upsertIfAbsent({
					pluginName: entry.pluginName,
					marketplaceName: entry.marketplaceName,
					pluginVersion: null,
					installTrigger: null,
					marketplaceIsOfficial: null,
					status,
				});
			}
			await deps.pluginSkills.upsertMany(pluginSkillPairs);
		}

		// Track version sightings from plugin_installed + plugin_loaded events.
		// Same logic as the OTLP push path (ingest-events.ts) — keeps the two
		// ingress paths consistent.
		const versionSightings: PluginVersionSeen[] = [];
		for (const e of parsedEvents) {
			if (
				e.eventName !== EVENT_NAMES.PLUGIN_INSTALLED &&
				e.eventName !== EVENT_NAMES.PLUGIN_LOADED
			) continue;
			const pluginName = e.attributes["plugin.name"];
			const version = e.attributes["plugin.version"];
			if (typeof pluginName !== "string" || pluginName === "third-party") continue;
			if (typeof version !== "string" || version.length === 0) continue;
			versionSightings.push({
				pluginName,
				marketplaceName: normalizeMarketplaceName(
					typeof e.attributes["marketplace.name"] === "string"
						? (e.attributes["marketplace.name"] as string)
						: null,
				),
				version,
			});
		}
		if (versionSightings.length > 0) {
			await deps.pluginVersions.upsertSeen(versionSightings);
		}

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

		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "integration_sync_completed",
				target: integration.id,
				metadata: {
					mode,
					durationMs: Date.now() - startedAt,
					eventCount: parsedEvents.length,
					morePending: hitLimit,
					error: null,
				},
			});
		}

		await publishIntegrationUpdate(deps.integrations, integration.id);

		return { syncedAt, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.integrations.updateSyncStatus(integration.id, { lastSyncError: message });
		console.error(`[loki-sync] ${integration.name}: sync failed — ${message}`);

		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "integration_sync_completed",
				target: integration.id,
				metadata: {
					mode,
					durationMs: Date.now() - startedAt,
					eventCount: 0,
					error: message,
				},
			});
		}

		await publishIntegrationUpdate(deps.integrations, integration.id);

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
	return parseLokiStreams(streams)
		.filter(
			(e) =>
				e.eventName === EVENT_NAMES.SKILL_ACTIVATED ||
				e.eventName === EVENT_NAMES.PLUGIN_INSTALLED ||
				e.eventName === EVENT_NAMES.PLUGIN_LOADED,
		)
		.map((e) => ({
			...e,
			source: "integration" as const,
			sourceIntegrationId: integrationId,
		}));
}
