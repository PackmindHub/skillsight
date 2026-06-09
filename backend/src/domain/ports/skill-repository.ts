import type { Skill, SkillDetailRow, SkillKey, SkillStatus, SkillTableRow } from "@/domain/skill";

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
	deleteByKeys(entries: SkillKey[]): Promise<number>;
	findByKey(key: SkillKey): Promise<Skill | null>;
	updateStatus(key: SkillKey, status: SkillStatus): Promise<Skill | null>;
	// Move the legacy bare-orphan row (skillName, '', '', '') over to a real
	// plugin-owned identity (skillName, pluginName, marketplaceName, 'plugin'),
	// preserving its status/firstSeenAt. If no bare orphan exists, the call is a
	// no-op for that entry; if the linked row already exists, the orphan is dropped
	// without touching it. Used by sync flows that retro-associate skills (e.g.
	// Packmind) to clean up orphan rows created by ingest before the mapping
	// existed.
	relinkOrphans(
		entries: Array<{ skillName: string; pluginName: string; marketplaceName: string }>,
	): Promise<number>;
}

export interface SkillUpsertEntry {
	skillName: string;
	pluginName?: string | null;
	marketplaceName?: string | null;
	skillSource?: string | null;
}
