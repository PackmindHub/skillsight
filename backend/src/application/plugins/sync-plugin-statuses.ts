import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";
import { computePluginStatus } from "@/domain/plugin";

export async function syncPluginStatuses(
	deps: { plugins: IPluginRepository },
	marketplaceName: string,
	newMarketplaceStatus: MarketplaceStatus,
): Promise<void> {
	const pluginStatus = computePluginStatus(marketplaceName, newMarketplaceStatus);
	await deps.plugins.updateStatusByMarketplace(marketplaceName, pluginStatus);
}
