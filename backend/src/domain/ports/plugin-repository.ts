import type { NewPlugin, PluginStatus, PluginWithStats } from "@/domain/plugin";

export interface IPluginRepository {
	listWithStats(): Promise<PluginWithStats[]>;
	upsert(plugin: NewPlugin): Promise<void>;
	updateStatusByMarketplace(marketplaceName: string, status: PluginStatus): Promise<void>;
	markRemovedByMarketplace(marketplaceName: string, activePluginNames: string[]): Promise<void>;
}
