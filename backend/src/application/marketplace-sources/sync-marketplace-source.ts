import { recordAudit } from "@/application/audit/record-audit";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import { computePluginStatus } from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IGitMarketplaceGateway } from "@/domain/ports/git-marketplace-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { decrypt } from "@/infrastructure/crypto/encrypt";

interface SyncDeps {
	marketplaceSources: IMarketplaceSourceRepository;
	marketplaces: IMarketplaceRepository;
	plugins: IPluginRepository;
	pluginSkills: IPluginSkillRepository;
	skills: ISkillRepository;
	gitMarketplace: IGitMarketplaceGateway;
	audit: IAuditRepository;
}

export interface SyncMarketplaceSourceOptions {
	actorEmail?: string | null;
	mode?: "manual" | "scheduled";
}

export async function syncMarketplaceSource(
	deps: SyncDeps,
	source: MarketplaceSourceWithSecret,
	options: SyncMarketplaceSourceOptions = {},
): Promise<{ syncedAt: Date | null; pluginCount: number; skillCount: number; error: string | null }> {
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

	try {
		const data = await deps.gitMarketplace.fetchMarketplaceJson({
			gitUrl: source.gitUrl,
			accessToken,
			branch: source.branch ?? undefined,
		});

		await deps.marketplaces.upsertFromImport({
			name: data.name,
			url: source.gitUrl,
			description: data.description ?? null,
		});

		const pluginCount = data.plugins.length;
		const skillCount = data.plugins.reduce((sum, p) => sum + (p.skills?.length ?? 0), 0);

		if (source.importPluginsAndSkills) {
			const marketplace = await deps.marketplaces.findByName(data.name);
			const marketplaceStatus = marketplace?.status ?? "approved";
			const pluginStatus = computePluginStatus(data.name, marketplaceStatus);

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
