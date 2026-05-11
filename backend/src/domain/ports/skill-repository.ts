import type { Skill, SkillDetailRow, SkillStatus, SkillTableRow } from "@/domain/skill";

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
	getSkillDetail(skillName: string, days: DaysWindow): Promise<SkillDetailRow | null>;
	getMonthlyTrends(): Promise<MonthlyTrends>;
	upsertMany(entries: SkillUpsertEntry[]): Promise<void>;
	propagateStatusFromPlugins(affectedPluginNames: string[], newStatus: SkillStatus): Promise<void>;
	deleteByPlugins(pluginNames: string[]): Promise<void>;
	deleteByKeys(entries: Array<{ skillName: string; pluginName: string }>): Promise<number>;
	findByKey(key: { skillName: string; pluginName: string }): Promise<Skill | null>;
	updateStatus(
		key: { skillName: string; pluginName: string },
		status: SkillStatus,
	): Promise<Skill | null>;
}

export interface SkillUpsertEntry {
	skillName: string;
	pluginName?: string | null;
}
