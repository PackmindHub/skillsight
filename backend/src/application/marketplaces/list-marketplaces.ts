import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { MarketplaceWithStats } from "@/domain/marketplace";

export async function listMarketplaces(
	deps: { marketplaces: IMarketplaceRepository },
): Promise<MarketplaceWithStats[]> {
	return deps.marketplaces.listWithStats();
}
