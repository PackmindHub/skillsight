import { recordAudit } from "@/application/audit/record-audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";

export type DeleteMarketplaceMode = "orphan" | "cascade";

export type DeleteMarketplaceResult =
	| {
			ok: true;
			mode: DeleteMarketplaceMode;
			affectedPluginNames: string[];
			deletedSourceIds: string[];
	  }
	| { ok: false; reason: "not_found" }
	| { ok: false; reason: "linked_sources"; sourceIds: string[] };

export async function deleteMarketplace(
	deps: {
		marketplaces: IMarketplaceRepository;
		marketplaceSources: IMarketplaceSourceRepository;
		plugins: IPluginRepository;
		pluginSkills: IPluginSkillRepository;
		skills: ISkillRepository;
		audit: IAuditRepository;
	},
	input: { name: string; mode: DeleteMarketplaceMode; withSources?: boolean },
	options?: { actorEmail?: string | null },
): Promise<DeleteMarketplaceResult> {
	const existing = await deps.marketplaces.findByName(input.name);
	if (!existing) return { ok: false, reason: "not_found" };

	const linkedSources = await deps.marketplaceSources.findByMarketplaceName(input.name);
	if (linkedSources.length > 0 && !input.withSources) {
		return {
			ok: false,
			reason: "linked_sources",
			sourceIds: linkedSources.map((s) => s.id),
		};
	}

	const deletedSourceIds: string[] = [];
	for (const source of linkedSources) {
		await deps.marketplaceSources.delete(source.id);
		deletedSourceIds.push(source.id);
	}

	let affectedPluginNames: string[];
	if (input.mode === "cascade") {
		const pluginNames = await deps.plugins.listNamesByMarketplace(input.name);
		await deps.pluginSkills.deleteByPlugins(pluginNames);
		await deps.skills.deleteByPlugins(pluginNames);
		affectedPluginNames = await deps.plugins.deleteByMarketplace(input.name);
	} else {
		affectedPluginNames = await deps.plugins.orphanByMarketplace(input.name);
	}

	await deps.marketplaces.delete(input.name);

	await recordAudit(deps, {
		actorEmail: options?.actorEmail ?? null,
		action: "marketplace_deleted",
		target: input.name,
		metadata: {
			mode: input.mode,
			status: existing.status,
			url: existing.url,
			description: existing.description,
			affectedPluginNames,
			affectedPluginCount: affectedPluginNames.length,
			deletedSourceIds,
			deletedSourceCount: deletedSourceIds.length,
		},
	});

	return { ok: true, mode: input.mode, affectedPluginNames, deletedSourceIds };
}
