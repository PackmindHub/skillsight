import type { SkillTableRow } from "@/domain/skill";

export type DaysWindow = number | "all";

export interface MonthlyPoint {
	month: string;
	count: number;
}

export interface MonthlyTrends {
	invocations: MonthlyPoint[];
	uniqueSkills: MonthlyPoint[];
	uniqueUsers: MonthlyPoint[];
}

export interface ISkillRepository {
	getTopSkills(days: DaysWindow): Promise<Array<{ skillName: string; count: number }>>;
	getDailyTrend(days: DaysWindow): Promise<Array<{ date: string; count: number }>>;
	getTopUsers(days: DaysWindow): Promise<Array<{ userEmail: string; count: number }>>;
	getByTrigger(days: DaysWindow): Promise<Array<{ trigger: string | null; count: number }>>;
	getTotalActivations(days: DaysWindow): Promise<number>;
	getUniqueSkillsCount(days: DaysWindow): Promise<number>;
	getActiveUsersCount(days: DaysWindow): Promise<number>;
	getSkillsTable(days: DaysWindow): Promise<SkillTableRow[]>;
	getMonthlyTrends(): Promise<MonthlyTrends>;
}
