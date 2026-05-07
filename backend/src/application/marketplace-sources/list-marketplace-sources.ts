import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { MarketplaceSource } from "@/domain/marketplace-source";

export async function listMarketplaceSources(deps: {
	marketplaceSources: IMarketplaceSourceRepository;
}): Promise<MarketplaceSource[]> {
	const sources = await deps.marketplaceSources.findAll();
	return sources.map((s) => ({
		id: s.id,
		gitUrl: s.gitUrl,
		hasToken: s.hasToken,
		branch: s.branch,
		marketplaceName: s.marketplaceName,
		syncIntervalMs: s.syncIntervalMs,
		enabled: s.enabled,
		importPluginsAndSkills: s.importPluginsAndSkills,
		lastSyncAt: s.lastSyncAt,
		lastSyncError: s.lastSyncError,
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	}));
}
