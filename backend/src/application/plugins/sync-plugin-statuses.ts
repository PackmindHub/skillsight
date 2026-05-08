import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { MarketplaceStatus } from "@/domain/marketplace";
import { computePluginStatus } from "@/domain/plugin";
import { recordAudit } from "@/application/audit/record-audit";

export async function syncPluginStatuses(
	deps: { plugins: IPluginRepository; audit: IAuditRepository },
	marketplaceName: string,
	newMarketplaceStatus: MarketplaceStatus,
	options: { actorEmail?: string | null } = {},
): Promise<void> {
	const pluginStatus = computePluginStatus(marketplaceName, newMarketplaceStatus);
	await deps.plugins.updateStatusByMarketplace(marketplaceName, pluginStatus);

	await recordAudit(deps, {
		actorEmail: options.actorEmail ?? null,
		action: "plugin_status_changed",
		target: marketplaceName,
		metadata: {
			marketplaceName,
			marketplaceStatus: newMarketplaceStatus,
			pluginStatus,
			scope: "by_marketplace",
		},
	});
}
