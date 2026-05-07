export interface MarketplaceSource {
	id: string;
	gitUrl: string;
	hasToken: boolean;
	branch: string | null;
	marketplaceName: string | null;
	syncIntervalMs: number;
	enabled: boolean;
	importPluginsAndSkills: boolean;
	lastSyncAt: Date | null;
	lastSyncError: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface MarketplaceSourceWithSecret extends MarketplaceSource {
	accessTokenEncrypted: string | null;
}

export interface CreateMarketplaceSourceData {
	gitUrl: string;
	accessToken?: string;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}

export interface UpdateMarketplaceSourceData {
	gitUrl?: string;
	accessToken?: string | null;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}
