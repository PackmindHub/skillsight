import { recordAudit } from "@/application/audit/record-audit";
import type { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import { computePluginStatus } from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPackmindCliGateway } from "@/domain/ports/packmind-cli-gateway";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import type { SyncMarketplaceSourceOptions, SyncResult } from "./sync-marketplace-source.types";

export interface SyncPackmindDeps {
	marketplaceSources: IMarketplaceSourceRepository;
	marketplaces: IMarketplaceRepository;
	plugins: IPluginRepository;
	pluginSkills: IPluginSkillRepository;
	skills: ISkillRepository;
	externalSkillMappings: IExternalSkillPluginMappingRepository;
	mappingCache: ExternalSkillMappingCache;
	packmindCli: IPackmindCliGateway;
	audit: IAuditRepository;
}

const PACKMIND_HOST_URL = "https://app.packmind.ai";

export async function syncPackmindMarketplaceSource(
	deps: SyncPackmindDeps,
	source: MarketplaceSourceWithSecret,
	options: SyncMarketplaceSourceOptions = {},
): Promise<SyncResult> {
	const now = new Date();
	const mode = options.mode ?? "scheduled";
	const actorEmail = options.actorEmail ?? null;
	const startedAt = Date.now();
	const marketplaceName = source.marketplaceName?.trim();

	if (mode === "manual") {
		await recordAudit(deps, {
			actorEmail,
			action: "marketplace_source_sync_triggered",
			target: source.id,
			metadata: { mode, kind: "packmind", marketplaceName },
		});
	}

	if (!marketplaceName) {
		const error = "Packmind source has no marketplace name configured";
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: error });
		return { syncedAt: null, pluginCount: 0, skillCount: 0, error };
	}
	if (!source.accessTokenEncrypted) {
		const error = "Packmind source has no API key configured";
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: error });
		return { syncedAt: null, pluginCount: 0, skillCount: 0, error };
	}

	const apiKey = decrypt(source.accessTokenEncrypted);

	try {
		const packages = await deps.packmindCli.listPackages(apiKey);
		const details = await Promise.all(
			packages.map((p) => deps.packmindCli.showPackage(apiKey, p.slug)),
		);

		await deps.marketplaces.upsertFromImport({
			name: marketplaceName,
			provider: "packmind",
			url: PACKMIND_HOST_URL,
			description: `Packmind organization synced via packmind-cli (${packages.length} package${
				packages.length === 1 ? "" : "s"
			}).`,
		});

		const marketplace = await deps.marketplaces.findByName(marketplaceName);
		const marketplaceStatus = marketplace?.status ?? "approved";
		const pluginStatus = computePluginStatus(marketplaceName, marketplaceStatus);

		// Upsert plugins. Plugin name = the Packmind slug ("@space/pkg").
		for (const pkg of packages) {
			await deps.plugins.upsert({
				pluginName: pkg.slug,
				marketplaceName,
				pluginVersion: null,
				installTrigger: null,
				marketplaceIsOfficial: false,
				source: pkg.url ?? null,
				status: pluginStatus,
			});
		}

		const presentPluginNames = packages.map((p) => p.slug);
		const removedPluginNames = await deps.plugins.markRemovedByMarketplace(
			marketplaceName,
			presentPluginNames,
		);
		await deps.plugins.reactivateRemovedByMarketplace(
			marketplaceName,
			presentPluginNames,
			pluginStatus,
		);

		// Replace plugin_skills for each present plugin (clean slate via deleteByPlugins
		// then upsert from the detail set).
		await deps.pluginSkills.deleteByPlugins(presentPluginNames);
		const declaredPairs: Array<{ pluginName: string; skillName: string }> = [];
		const mappingRows: Array<{
			skillName: string;
			pluginName: string;
			marketplaceName: string;
			sourceId: string;
		}> = [];
		for (const detail of details) {
			for (const skill of detail.skills) {
				declaredPairs.push({ pluginName: detail.slug, skillName: skill.name });
				mappingRows.push({
					skillName: skill.name,
					pluginName: detail.slug,
					marketplaceName,
					sourceId: source.id,
				});
			}
		}
		if (declaredPairs.length > 0) {
			await deps.pluginSkills.upsertMany(declaredPairs);
		}

		// Retro-link any pre-existing orphan rows so the skills table reflects the
		// new ownership immediately.
		await deps.skills.relinkOrphans(
			declaredPairs.map((p) => ({ skillName: p.skillName, pluginName: p.pluginName })),
		);

		// Make sure every declared (skill, plugin) has a skills row at all — if
		// neither an orphan nor a linked row existed, upsertMany creates one.
		if (declaredPairs.length > 0) {
			await deps.skills.upsertMany(declaredPairs);
		}

		// Replace the ingest-time mapping for this source.
		await deps.externalSkillMappings.upsertMany(mappingRows);
		await deps.externalSkillMappings.deleteMissingForSource(
			source.id,
			mappingRows.map((r) => r.skillName),
		);
		await deps.mappingCache.refresh();

		// Status cascade.
		if (presentPluginNames.length > 0) {
			await deps.skills.propagateStatusFromPlugins(presentPluginNames, pluginStatus);
		}
		if (removedPluginNames.length > 0) {
			await deps.skills.propagateStatusFromPlugins(removedPluginNames, "removed");
		}

		await deps.marketplaceSources.updateSyncStatus(source.id, {
			lastSyncAt: now,
			lastSyncError: null,
			marketplaceName,
		});

		const pluginCount = packages.length;
		const skillCount = mappingRows.length;
		console.log(
			`[marketplace-sync] source ${source.id} (packmind): synced ${pluginCount} plugin(s) / ${skillCount} skill(s) into "${marketplaceName}"`,
		);

		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "marketplace_source_sync_completed",
				target: source.id,
				metadata: {
					mode,
					kind: "packmind",
					durationMs: Date.now() - startedAt,
					marketplaceName,
					pluginCount,
					skillCount,
					imported: true,
					error: null,
				},
			});
		}

		return { syncedAt: now, pluginCount, skillCount, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: message });
		console.error(`[marketplace-sync] source ${source.id} (packmind): sync failed — ${message}`);
		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "marketplace_source_sync_completed",
				target: source.id,
				metadata: {
					mode,
					kind: "packmind",
					durationMs: Date.now() - startedAt,
					pluginCount: 0,
					skillCount: 0,
					error: message,
				},
			});
		}
		return { syncedAt: null, pluginCount: 0, skillCount: 0, error: message };
	}
}
