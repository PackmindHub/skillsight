import type {
	Marketplace,
	MarketplacePluginRow,
	MarketplaceSkillRow,
	MarketplaceStatus,
	MarketplaceWithStats,
} from "@/domain/marketplace";

export interface IMarketplaceRepository {
	listWithStats(): Promise<MarketplaceWithStats[]>;
	findByName(name: string): Promise<Marketplace | null>;
	update(
		name: string,
		data: Partial<Pick<Marketplace, "status" | "url" | "description">>,
	): Promise<Marketplace>;
	upsertSeen(names: string[]): Promise<void>;
	upsertFromImport(data: {
		name: string;
		url?: string | null;
		description?: string | null;
	}): Promise<void>;
	listStatuses(): Promise<Array<{ name: string; status: MarketplaceStatus }>>;
	listPluginsForMarketplace(name: string): Promise<MarketplacePluginRow[]>;
	listSkillsForMarketplace(name: string): Promise<MarketplaceSkillRow[]>;
}
