export interface MarketplacePluginEntry {
	name: string;
	description?: string;
	version?: string;
	skills?: string[];
	source?: string;
}

export interface MarketplaceJsonData {
	name: string;
	description?: string;
	plugins: MarketplacePluginEntry[];
}

import type { GitProvider } from "@/domain/marketplace-source";

export interface IGitMarketplaceGateway {
	fetchMarketplaceJson(params: {
		gitUrl: string;
		accessToken?: string;
		branch?: string;
		provider?: GitProvider;
	}): Promise<MarketplaceJsonData>;
}
