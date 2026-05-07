import type { AllowedSkill, ShadowSkill, SkillTableRow } from "@/domain/skill";

export interface ISkillRepository {
	listAllowed(): Promise<AllowedSkill[]>;
	addAllowed(data: {
		skillName: string;
		source: string;
		addedBy: string;
	}): Promise<AllowedSkill | null>;
	removeAllowed(skillName: string): Promise<AllowedSkill | null>;
	getTopSkills(days: number): Promise<Array<{ skillName: string; count: number }>>;
	getDailyTrend(days: number): Promise<Array<{ date: string; count: number }>>;
	getTopUsers(days: number): Promise<Array<{ userEmail: string; count: number }>>;
	getByTrigger(days: number): Promise<Array<{ trigger: string | null; count: number }>>;
	getTotalActivations(days: number): Promise<number>;
	getUniqueSkillsCount(days: number): Promise<number>;
	getActiveUsersCount(days: number): Promise<number>;
	getSkillsTable(days: number): Promise<SkillTableRow[]>;
	getShadowSkills(): Promise<ShadowSkill[]>;
}
