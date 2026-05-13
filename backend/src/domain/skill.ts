export type SkillStatus = "to_review" | "approved" | "removed" | "denied" | "ignored";

export const SKILL_STATUSES: readonly SkillStatus[] = [
	"to_review",
	"approved",
	"removed",
	"denied",
	"ignored",
] as const;

/**
 * Wire values for the `skill.source` OTLP attribute emitted by Claude Code.
 * See https://docs.claude.com/en/docs/claude-code/monitoring-usage (event `claude_code.skill_activated`).
 * Treat as the single source of truth — UI labels live in
 * frontend `SKILL_SOURCE_LABELS`, behavior helpers below.
 */
export type SkillSource = "bundled" | "userSettings" | "projectSettings" | "plugin";

export const SKILL_SOURCES: readonly SkillSource[] = [
	"bundled",
	"userSettings",
	"projectSettings",
	"plugin",
] as const;

export function isBundledSource(skillSource: string | null): boolean {
	return skillSource === "bundled";
}

export interface Skill {
	skillName: string;
	pluginName: string;
	status: SkillStatus;
	firstSeenAt: Date;
	lastSeenAt: Date;
}

export interface SkillTableRow {
	skillName: string;
	pluginName: string | null;
	skillSource: string | null;
	total: number;
	uniqueUsers: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: number[];
	marketplaceNames: string[];
	status: SkillStatus;
	lastSeenAt: string | null;
	// Distinct users who emitted a `plugin_loaded` event for this row's plugin
	// (joined by plugin.name only — same granularity as the rest of the table).
	// Null for bundled / orphan rows where `pluginName` is null.
	pluginUniqueLoaders: number | null;
}

export interface SkillDetailPluginRef {
	pluginName: string;
	marketplaceName: string | null;
	status: string;
	skillRepoUrl: string | null;
	loadCount: number;
	uniqueLoaderCount: number;
	latestVersion: string | null;
}

/**
 * Bundled skills ship inside Claude Code itself, so they are trusted by
 * default — coerce a "to_review" status to "approved" for them. An explicit
 * non-"to_review" choice in the DB always wins.
 */
export function defaultBundledStatus(
	status: SkillStatus,
	skillSource: string | null,
): SkillStatus {
	return status === "to_review" && isBundledSource(skillSource) ? "approved" : status;
}

export interface SkillDetailRow {
	skillName: string;
	skillSource: string | null;
	total: number;
	uniqueUsers: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: { date: string; count: number }[];
	topUsers: { userEmail: string; count: number }[];
	firstSeenAt: string | null;
	lastSeenAt: string | null;
	marketplaceNames: string[];
	plugins: SkillDetailPluginRef[];
	status: SkillStatus;
}
