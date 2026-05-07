export interface SkillTableRow {
	skillName: string;
	skillSource: string | null;
	total: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	marketplaceNames: string[];
	status: "removed" | null;
}
