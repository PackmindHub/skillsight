import type { SkillTableRow } from "@/domain/skill";

export interface ISkillRepository {
	getTopSkills(days: number): Promise<Array<{ skillName: string; count: number }>>;
	getDailyTrend(days: number): Promise<Array<{ date: string; count: number }>>;
	getTopUsers(days: number): Promise<Array<{ userEmail: string; count: number }>>;
	getByTrigger(days: number): Promise<Array<{ trigger: string | null; count: number }>>;
	getTotalActivations(days: number): Promise<number>;
	getUniqueSkillsCount(days: number): Promise<number>;
	getActiveUsersCount(days: number): Promise<number>;
	getSkillsTable(days: number): Promise<SkillTableRow[]>;
}
