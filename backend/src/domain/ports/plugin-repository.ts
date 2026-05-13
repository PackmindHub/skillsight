import type {
	NewPlugin,
	Plugin,
	PluginSkillActivation,
	PluginStatus,
	PluginUserActivation,
	PluginWithStats,
} from "@/domain/plugin";

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
}
