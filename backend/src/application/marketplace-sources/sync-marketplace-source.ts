import { recordAudit } from "@/application/audit/record-audit";
import type { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import { computePluginStatus, type PluginVersionSeen } from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";
import type { IGitMarketplaceGateway } from "@/domain/ports/git-marketplace-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPackmindCliGateway } from "@/domain/ports/packmind-cli-gateway";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import { syncPackmindMarketplaceSource } from "./sync-packmind-marketplace-source";
import type { SyncMarketplaceSourceOptions, SyncResult } from "./sync-marketplace-source.types";

export type { SyncMarketplaceSourceOptions, SyncResult } from "./sync-marketplace-source.types";

export interface SyncDeps {
	marketplaceSources: IMarketplaceSourceRepository;
	marketplaces: IMarketplaceRepository;
	plugins: IPluginRepository;
	pluginSkills: IPluginSkillRepository;
	pluginVersions: IPluginVersionRepository;
	skills: ISkillRepository;
	gitMarketplace: IGitMarketplaceGateway;
	packmindCli: IPackmindCliGateway;
	externalSkillMappings: IExternalSkillPluginMappingRepository;
	mappingCache: ExternalSkillMappingCache;
	audit: IAuditRepository;
}

export async function syncMarketplaceSource(
	deps: SyncDeps,
	source: MarketplaceSourceWithSecret,
	options: SyncMarketplaceSourceOptions = {},
): Promise<SyncResult> {
	if (source.kind === "packmind") {
		return syncPackmindMarketplaceSource(
			{
				marketplaceSources: deps.marketplaceSources,
				marketplaces: deps.marketplaces,
				plugins: deps.plugins,
				pluginSkills: deps.pluginSkills,
				skills: deps.skills,
				externalSkillMappings: deps.externalSkillMappings,
				mappingCache: deps.mappingCache,
				packmindCli: deps.packmindCli,
				audit: deps.audit,
			},
			source,
			options,
		);
	}
	return syncGitMarketplaceSource(deps, source, options);
}

async function syncGitMarketplaceSource(
	deps: SyncDeps,
	source: MarketplaceSourceWithSecret,
	options: SyncMarketplaceSourceOptions,
): Promise<SyncResult> {
	const now = new Date();
	const mode = options.mode ?? "scheduled";
	const actorEmail = options.actorEmail ?? null;
	const startedAt = Date.now();

	if (mode === "manual") {
		await recordAudit(deps, {
			actorEmail,
			action: "marketplace_source_sync_triggered",
			target: source.id,
			metadata: { mode, gitUrl: source.gitUrl, branch: source.branch },
		});
	}

	const accessToken = source.accessTokenEncrypted ? decrypt(source.accessTokenEncrypted) : undefined;

	if (!source.gitUrl) {
		const error = "Git source has no git URL configured";
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: error });
		return { syncedAt: null, pluginCount: 0, skillCount: 0, error };
	}
	const gitUrl = source.gitUrl;

	try {
		const data = await deps.gitMarketplace.fetchMarketplaceJson({
			gitUrl,
			accessToken,
			branch: source.branch ?? undefined,
		});

		await deps.marketplaces.upsertFromImport({
			name: data.name,
			provider: "git",
			url: gitUrl,
			description: data.description ?? null,
		});

		const pluginCount = data.plugins.length;
		const skillCount = data.plugins.reduce((sum, p) => sum + (p.skills?.length ?? 0), 0);

		if (source.importPluginsAndSkills) {
			const marketplace = await deps.marketplaces.findByName(data.name);
			const marketplaceStatus = marketplace?.status ?? "approved";
			const pluginStatus = computePluginStatus(data.name, marketplaceStatus);

			const versionSightings: PluginVersionSeen[] = [];
			for (const plugin of data.plugins) {
				await deps.plugins.upsert({
					pluginName: plugin.name,
					marketplaceName: data.name,
					pluginVersion: plugin.version ?? null,
					installTrigger: null,
					marketplaceIsOfficial: false,
					source: plugin.source ?? null,
					status: pluginStatus,
				});
				if (plugin.version) {
					versionSightings.push({
						pluginName: plugin.name,
						marketplaceName: data.name,
						version: plugin.version,
					});
				}
			}
			if (versionSightings.length > 0) {
				await deps.pluginVersions.upsertSeen(versionSightings);
			}

			const presentPluginNames = data.plugins.map((p) => p.name);
			const removedPluginNames = await deps.plugins.markRemovedByMarketplace(
				data.name,
				presentPluginNames,
			);
			const reactivatedPluginNames = await deps.plugins.reactivateRemovedByMarketplace(
				data.name,
				presentPluginNames,
				pluginStatus,
			);

			const allSkills = data.plugins.flatMap((plugin) =>
				(plugin.skills ?? []).map((skillName) => ({
					pluginName: plugin.name,
					skillName: `${plugin.name}:${skillName}`,
				})),
			);
			if (allSkills.length > 0) {
				await deps.pluginSkills.upsertMany(allSkills);
				await deps.skills.upsertMany(allSkills);
			}

			if (presentPluginNames.length > 0) {
				await deps.skills.propagateStatusFromPlugins(presentPluginNames, pluginStatus);
			}
			if (removedPluginNames.length > 0) {
				await deps.skills.propagateStatusFromPlugins(removedPluginNames, "removed");
			}

			if (removedPluginNames.length > 0 || reactivatedPluginNames.length > 0) {
				console.log(
					`[marketplace-sync] source ${source.id}: upserted=${pluginCount} removed=${removedPluginNames.length} reactivated=${reactivatedPluginNames.length}`,
				);
			}
		}

		await deps.marketplaceSources.updateSyncStatus(source.id, {
			lastSyncAt: now,
			lastSyncError: null,
			marketplaceName: data.name,
		});

		console.log(
			`[marketplace-sync] source ${source.id}: ${source.importPluginsAndSkills ? "imported" : "discovered"} ${pluginCount} plugin(s) from "${data.name}"`,
		);

		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "marketplace_source_sync_completed",
				target: source.id,
				metadata: {
					mode,
					durationMs: Date.now() - startedAt,
					marketplaceName: data.name,
					pluginCount,
					skillCount,
					imported: source.importPluginsAndSkills,
					error: null,
				},
			});
		}

		return { syncedAt: now, pluginCount, skillCount, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: message });
		console.error(`[marketplace-sync] source ${source.id}: sync failed — ${message}`);

		if (mode === "manual") {
			await recordAudit(deps, {
				actorEmail,
				action: "marketplace_source_sync_completed",
				target: source.id,
				metadata: {
					mode,
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
