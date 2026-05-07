export interface Integration {
	id: string;
	type: string;
	name: string;
	url: string;
	authType: "none" | "basic";
	authUsername: string | null;
	hasPassword: boolean;
	lokiQuery: string;
	syncIntervalMs: number;
	enabled: boolean;
	lastSyncAt: Date | null;
	lastSyncError: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface IntegrationWithSecret extends Integration {
	authPasswordEncrypted: string | null;
}

export interface CreateIntegrationData {
	name: string;
	url: string;
	authType: "none" | "basic";
	authUsername?: string | null;
	authPassword?: string | null;
	lokiQuery: string;
	syncIntervalMs: number;
	enabled: boolean;
}

export interface UpdateIntegrationData {
	name?: string;
	url?: string;
	authType?: "none" | "basic";
	authUsername?: string | null;
	authPassword?: string | null;
	lokiQuery?: string;
	syncIntervalMs?: number;
	enabled?: boolean;
}
