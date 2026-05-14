import type {
	NewPlugin,
	Plugin,
	PluginLoadStats,
	PluginSkillActivation,
	PluginStatus,
	PluginUserActivation,
	PluginWeeklyLoaders,
	PluginWithStats,
} from "@/domain/plugin";
import type { TimeWindow } from "@/domain/ports/skill-repository";

export interface IPluginRepository {
	listWithStats(includeIgnored?: boolean): Promise<PluginWithStats[]>;
	listSkillsWithActivations(pluginName: string): Promise<PluginSkillActivation[]>;
	listTopUsers(pluginName: string, limit: number): Promise<PluginUserActivation[]>;
	findByName(pluginName: string): Promise<Plugin | null>;
	upsert(plugin: NewPlugin): Promise<void>;
	upsertIfAbsent(plugin: NewPlugin): Promise<void>;
	update(pluginName: string, updates: { status?: PluginStatus }): Promise<Plugin | null>;
	updateStatusByMarketplace(marketplaceName: string, status: PluginStatus): Promise<void>;
	markRemovedByMarketplace(
		marketplaceName: string,
		activePluginNames: string[],
	): Promise<string[]>;
	reactivateRemovedByMarketplace(
		marketplaceName: string,
		presentPluginNames: string[],
		newStatus: PluginStatus,
	): Promise<string[]>;
	listNamesByMarketplace(marketplaceName: string): Promise<string[]>;
	orphanByMarketplace(marketplaceName: string): Promise<string[]>;
	deleteByMarketplace(marketplaceName: string): Promise<string[]>;
	getLoadStats(window: TimeWindow): Promise<PluginLoadStats>;
	getWeeklyLoadersByVersion(
		pluginName: string,
		marketplaceName: string | null,
	): Promise<PluginWeeklyLoaders>;
}
