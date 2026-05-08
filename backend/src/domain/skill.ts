export interface SkillTableRow {
	skillName: string;
	skillSource: string | null;
	total: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: number[];
	marketplaceNames: string[];
	status: "removed" | null;
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
	status: "removed" | null;
}
