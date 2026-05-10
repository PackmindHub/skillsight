import type {
	NewPlugin,
	PluginSkillActivation,
	PluginStatus,
	PluginWithStats,
} from "@/domain/plugin";

export interface IPluginRepository {
	listWithStats(): Promise<PluginWithStats[]>;
	listSkillsWithActivations(pluginName: string): Promise<PluginSkillActivation[]>;
	upsert(plugin: NewPlugin): Promise<void>;
	upsertIfAbsent(plugin: NewPlugin): Promise<void>;
	updateStatusByMarketplace(marketplaceName: string, status: PluginStatus): Promise<void>;
	markRemovedByMarketplace(
		marketplaceName: string,
		activePluginNames: string[],
	): Promise<string[]>;
	listNamesByMarketplace(marketplaceName: string): Promise<string[]>;
	orphanByMarketplace(marketplaceName: string): Promise<string[]>;
	deleteByMarketplace(marketplaceName: string): Promise<string[]>;
}
