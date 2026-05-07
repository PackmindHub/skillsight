import type { Marketplace, MarketplaceStatus, MarketplaceWithStats } from "@/domain/marketplace";

export interface IMarketplaceRepository {
	listWithStats(): Promise<MarketplaceWithStats[]>;
	findByName(name: string): Promise<Marketplace | null>;
	update(
		name: string,
		data: Partial<Pick<Marketplace, "status" | "url" | "description">>,
	): Promise<Marketplace>;
	upsertSeen(names: string[]): Promise<void>;
	listStatuses(): Promise<Array<{ name: string; status: MarketplaceStatus }>>;
}
