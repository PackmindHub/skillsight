export interface MarketplacePluginEntry {
	name: string;
	description?: string;
	version?: string;
	skills?: string[];
}

export interface MarketplaceJsonData {
	name: string;
	description?: string;
	plugins: MarketplacePluginEntry[];
}

export interface IGitMarketplaceGateway {
	fetchMarketplaceJson(params: {
		gitUrl: string;
		accessToken?: string;
		branch?: string;
	}): Promise<MarketplaceJsonData>;
}
