export type PluginStatus = "unknown" | "to_review" | "approved" | "removed";

export interface Plugin {
	pluginName: string;
	marketplaceName: string | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	status: PluginStatus;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface PluginWithStats extends Plugin {
	installationCount: number;
	uniqueUserCount: number;
	skillCount: number;
}

export interface NewPlugin {
	pluginName: string;
	marketplaceName: string | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	status: PluginStatus;
}

export function computePluginStatus(
	marketplaceName: string | null | undefined,
	marketplaceStatus: string | null | undefined,
): PluginStatus {
	if (!marketplaceName) return "unknown";
	if (marketplaceStatus === "approved") return "approved";
	return "to_review";
}
