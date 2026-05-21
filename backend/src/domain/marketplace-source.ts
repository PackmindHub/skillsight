export type MarketplaceSourceKind = "git" | "packmind";

export interface MarketplaceSource {
	id: string;
	kind: MarketplaceSourceKind;
	gitUrl: string | null;
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
	kind?: MarketplaceSourceKind;
	gitUrl?: string;
	marketplaceName?: string;
	accessToken?: string;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}

export interface UpdateMarketplaceSourceData {
	gitUrl?: string;
	marketplaceName?: string;
	accessToken?: string | null;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}
