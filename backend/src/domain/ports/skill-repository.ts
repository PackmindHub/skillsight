import type { Skill, SkillDetailRow, SkillStatus, SkillTableRow } from "@/domain/skill";

export type DaysWindow = number | "all";

export type TimeWindow =
	| { kind: "preset"; days: DaysWindow }
	| { kind: "range"; from: Date; to: Date };

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
	getTopSkills(window: TimeWindow): Promise<Array<{ skillName: string; count: number }>>;
	getDailyTrend(window: TimeWindow): Promise<Array<{ date: string; count: number }>>;
	getTopUsers(window: TimeWindow): Promise<Array<{ userEmail: string; count: number }>>;
	getByTrigger(window: TimeWindow): Promise<Array<{ trigger: string | null; count: number }>>;
	getTotalActivations(window: TimeWindow): Promise<number>;
	getUniqueSkillsCount(window: TimeWindow): Promise<number>;
	getActiveUsersCount(window: TimeWindow): Promise<number>;
	getSkillsTable(window: TimeWindow, includeIgnored?: boolean): Promise<SkillTableRow[]>;
	getSkillDetail(skillName: string, window: TimeWindow): Promise<SkillDetailRow | null>;
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
	// Move the orphan row (skillName, '') over to a real plugin, preserving its
	// status/firstSeenAt. If no orphan exists, the call is a no-op for that
	// entry; if a linked row already exists, the orphan is dropped without
	// touching the existing linked row. Used by sync flows that retro-associate
	// skills (e.g. Packmind) to clean up legacy orphan rows from prior ingest.
	relinkOrphans(
		entries: Array<{ skillName: string; pluginName: string }>,
	): Promise<number>;
}

export interface SkillUpsertEntry {
	skillName: string;
	pluginName?: string | null;
}
