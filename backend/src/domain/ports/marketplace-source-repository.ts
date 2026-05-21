import type {
	MarketplaceSource,
	MarketplaceSourceKind,
	MarketplaceSourceWithSecret,
} from "@/domain/marketplace-source";

export interface IMarketplaceSourceRepository {
	findAll(): Promise<MarketplaceSourceWithSecret[]>;
	findById(id: string): Promise<MarketplaceSourceWithSecret | null>;
	findByMarketplaceName(name: string): Promise<MarketplaceSource[]>;
	create(data: {
		kind: MarketplaceSourceKind;
		gitUrl?: string | null;
		marketplaceName?: string | null;
		accessTokenEncrypted?: string | null;
		branch?: string | null;
		syncIntervalMs: number;
		enabled: boolean;
		importPluginsAndSkills?: boolean;
	}): Promise<MarketplaceSource>;
	update(
		id: string,
		data: {
			gitUrl?: string | null;
			marketplaceName?: string | null;
			accessTokenEncrypted?: string | null;
			branch?: string | null;
			syncIntervalMs?: number;
			enabled?: boolean;
			importPluginsAndSkills?: boolean;
		},
	): Promise<MarketplaceSource>;
	delete(id: string): Promise<void>;
	updateSyncStatus(
		id: string,
		data: {
			lastSyncAt?: Date | null;
			lastSyncError?: string | null;
			marketplaceName?: string | null;
		},
	): Promise<void>;
}
