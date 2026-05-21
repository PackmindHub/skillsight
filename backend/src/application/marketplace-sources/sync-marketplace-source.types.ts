export interface SyncMarketplaceSourceOptions {
	actorEmail?: string | null;
	mode?: "manual" | "scheduled";
}

export interface SyncResult {
	syncedAt: Date | null;
	pluginCount: number;
	skillCount: number;
	error: string | null;
}
