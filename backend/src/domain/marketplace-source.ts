export type MarketplaceSourceKind = "git" | "packmind";

// Which git host the source points at. "auto" detects the host from the URL (the legacy
// behavior); the explicit values let self-hosted instances — chiefly self-hosted GitLab,
// whose hostname cannot be guessed — be recognized so content is fetched via the right API.
export type GitProvider = "auto" | "github" | "gitlab" | "bitbucket";

export interface MarketplaceSource {
	id: string;
	kind: MarketplaceSourceKind;
	gitUrl: string | null;
	provider: GitProvider;
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
	provider?: GitProvider;
	marketplaceName?: string;
	accessToken?: string;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}

export interface UpdateMarketplaceSourceData {
	gitUrl?: string;
	provider?: GitProvider;
	marketplaceName?: string;
	accessToken?: string | null;
	branch?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
	importPluginsAndSkills?: boolean;
}
