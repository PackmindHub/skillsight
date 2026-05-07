import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { MarketplaceSource, CreateMarketplaceSourceData } from "@/domain/marketplace-source";
import { encrypt } from "@/infrastructure/crypto/encrypt";

export async function createMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository },
	data: CreateMarketplaceSourceData,
): Promise<MarketplaceSource> {
	const accessTokenEncrypted = data.accessToken ? encrypt(data.accessToken) : null;
	return deps.marketplaceSources.create({
		gitUrl: data.gitUrl,
		accessTokenEncrypted,
		branch: data.branch ?? null,
		syncIntervalMs: data.syncIntervalMs ?? 3600000,
		enabled: data.enabled ?? true,
		importPluginsAndSkills: data.importPluginsAndSkills ?? false,
	});
}
