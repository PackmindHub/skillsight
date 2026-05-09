import type { MarketplaceStatus } from "@/domain/marketplace";
import { computePluginStatus } from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";

export async function syncPluginStatuses(
	deps: { plugins: IPluginRepository; skills: ISkillRepository },
	marketplaceName: string,
	newMarketplaceStatus: MarketplaceStatus,
): Promise<void> {
	const pluginStatus = computePluginStatus(marketplaceName, newMarketplaceStatus);
	await deps.plugins.updateStatusByMarketplace(marketplaceName, pluginStatus);
	const affectedPluginNames = await deps.plugins.listNamesByMarketplace(marketplaceName);
	await deps.skills.propagateStatusFromPlugins(affectedPluginNames, pluginStatus);
}
