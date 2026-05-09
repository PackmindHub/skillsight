import { recordAudit } from "@/application/audit/record-audit";
import type { MarketplaceStatus } from "@/domain/marketplace";
import { computePluginStatus } from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";

export async function syncPluginStatuses(
	deps: {
		plugins: IPluginRepository;
		skills: ISkillRepository;
		audit: IAuditRepository;
	},
	marketplaceName: string,
	newMarketplaceStatus: MarketplaceStatus,
	options: { actorEmail?: string | null } = {},
): Promise<void> {
	const pluginStatus = computePluginStatus(marketplaceName, newMarketplaceStatus);
	await deps.plugins.updateStatusByMarketplace(marketplaceName, pluginStatus);

	const affectedPluginNames = await deps.plugins.listNamesByMarketplace(marketplaceName);
	await deps.skills.propagateStatusFromPlugins(affectedPluginNames, pluginStatus);

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
