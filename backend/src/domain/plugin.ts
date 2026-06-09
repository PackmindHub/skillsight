export type PluginStatus = "to_review" | "approved" | "removed" | "denied" | "ignored";

export interface Plugin {
	pluginName: string;
	marketplaceName: string | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	source: string | null;
	status: PluginStatus;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface PluginWithStats extends Plugin {
	// Set only for redacted "third-party" catalog rows, which are synthesized at
	// query time (one per distinct plugin_id_hash) rather than stored in the
	// `plugins` table. Null for every real cataloged plugin. Callers use it as the
	// row identity for third-party entries since they all share pluginName='third-party'.
	pluginIdHash: string | null;
	marketplaceStatus: string | null;
	installationCount: number;
	uniqueUserCount: number;
	skillCount: number;
	skillActivationCount: number;
	lastSkillActivationAt: Date | null;
	loadCount: number;
	uniqueLoaderCount: number;
	versionCount: number;
	// Semver-max across all observed versions for this (plugin, marketplace)
	// pair. Falls back to the catalog's `pluginVersion` if no plugin_versions
	// rows exist (legacy state). Null when neither is known.
	latestVersion: string | null;
}

export interface PluginSkillActivation {
	skillName: string;
	activationCount: number;
}

export interface PluginUserActivation {
	userEmail: string;
	activationCount: number;
}

export interface PluginLoadStats {
	totalLoads: number;
	uniqueLoadedPlugins: number;
	uniqueLoaders: number;
}

export interface PluginVersionRow {
	version: string;
	firstSeenAt: Date;
	lastSeenAt: Date;
	loadCount: number;
	uniqueLoaderCount: number;
}

export interface PluginVersionSeen {
	pluginName: string;
	marketplaceName: string | null;
	version: string;
}

export interface PluginWeeklyLoadersBucket {
	weekStart: string;
	total: number;
	perVersion: Record<string, number>;
}

export interface PluginWeeklyLoaders {
	weeks: PluginWeeklyLoadersBucket[];
	versions: string[];
}

export interface NewPlugin {
	pluginName: string;
	marketplaceName: string | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	source?: string | null;
	status: PluginStatus;
}

export function computePluginStatus(
	marketplaceName: string | null | undefined,
	marketplaceStatus: string | null | undefined,
): PluginStatus {
	if (!marketplaceName) return "to_review";
	if (marketplaceStatus === "ignored") return "ignored";
	if (marketplaceStatus === "denied") return "denied";
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
