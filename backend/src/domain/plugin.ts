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
	skillActivationCount: number;
}

export interface PluginSkillActivation {
	skillName: string;
	activationCount: number;
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

// Claude Code emits marketplace.name="inline" for plugins installed locally on
// the user's workspace (no real marketplace). Normalize to null so these rows
// don't pollute the marketplaces table or appear as a clickable marketplace.
export function normalizeMarketplaceName(
	raw: string | null | undefined,
): string | null {
	if (!raw) return null;
	if (raw === "inline") return null;
	return raw;
}
