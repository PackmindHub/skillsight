export type SkillStatus = "unknown" | "to_review" | "approved" | "removed";

export const SKILL_STATUSES: readonly SkillStatus[] = [
	"unknown",
	"to_review",
	"approved",
	"removed",
] as const;

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
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: number[];
	marketplaceNames: string[];
	status: SkillStatus;
	lastSeenAt: string | null;
}

export interface SkillDetailPluginRef {
	pluginName: string;
	marketplaceName: string | null;
	status: string;
}

export interface SkillDetailRow {
	skillName: string;
	skillSource: string | null;
	total: number;
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
