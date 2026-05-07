import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IGitMarketplaceGateway } from "@/domain/ports/git-marketplace-gateway";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import { computePluginStatus } from "@/domain/plugin";
import { decrypt } from "@/infrastructure/crypto/encrypt";

interface SyncDeps {
	marketplaceSources: IMarketplaceSourceRepository;
	marketplaces: IMarketplaceRepository;
	plugins: IPluginRepository;
	pluginSkills: IPluginSkillRepository;
	gitMarketplace: IGitMarketplaceGateway;
}

export async function syncMarketplaceSource(
	deps: SyncDeps,
	source: MarketplaceSourceWithSecret,
): Promise<{ syncedAt: Date | null; pluginCount: number; skillCount: number; error: string | null }> {
	const now = new Date();
	const accessToken =
		source.accessTokenEncrypted ? decrypt(source.accessTokenEncrypted) : undefined;

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

			for (const plugin of data.plugins) {
				const status = computePluginStatus(data.name, marketplaceStatus);
				await deps.plugins.upsert({
					pluginName: plugin.name,
					marketplaceName: data.name,
					pluginVersion: plugin.version ?? null,
					installTrigger: null,
					marketplaceIsOfficial: false,
					status,
				});
			}

			await deps.plugins.markRemovedByMarketplace(
				data.name,
				data.plugins.map((p) => p.name),
			);

			const allSkills = data.plugins.flatMap((plugin) =>
				(plugin.skills ?? []).map((skillName) => ({ pluginName: plugin.name, skillName })),
			);
			if (allSkills.length > 0) {
				await deps.pluginSkills.upsertMany(allSkills);
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

		return { syncedAt: now, pluginCount, skillCount, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.marketplaceSources.updateSyncStatus(source.id, { lastSyncError: message });
		console.error(`[marketplace-sync] source ${source.id}: sync failed — ${message}`);
		return { syncedAt: null, pluginCount: 0, skillCount: 0, error: message };
	}
}
