import type {
	MarketplaceSource,
	MarketplaceSourceWithSecret,
} from "@/domain/marketplace-source";

export interface IMarketplaceSourceRepository {
	findAll(): Promise<MarketplaceSourceWithSecret[]>;
	findById(id: string): Promise<MarketplaceSourceWithSecret | null>;
	create(data: {
		gitUrl: string;
		accessTokenEncrypted?: string | null;
		branch?: string | null;
		syncIntervalMs: number;
		enabled: boolean;
		importPluginsAndSkills?: boolean;
	}): Promise<MarketplaceSource>;
	update(
		id: string,
		data: {
			gitUrl?: string;
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
