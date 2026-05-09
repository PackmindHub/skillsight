import type { MarketplaceDetail } from "@/domain/marketplace";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";

export async function listMarketplaceDetail(
	deps: { marketplaces: IMarketplaceRepository },
	name: string,
): Promise<MarketplaceDetail> {
	const [plugins, skills] = await Promise.all([
		deps.marketplaces.listPluginsForMarketplace(name),
		deps.marketplaces.listSkillsForMarketplace(name),
	]);
	return { plugins, skills };
}
