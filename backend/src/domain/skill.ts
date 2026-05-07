export interface AllowedSkill {
	skillName: string;
	source: string | null;
	addedAt: Date;
	addedBy: string | null;
}

export interface ShadowSkill {
	skillName: string;
	count: number;
	firstSeen: string;
	lastSeen: string;
	distinctUsers: number;
}

export interface SkillTableRow {
	skillName: string;
	total: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	marketplaceNames: string[];
}
