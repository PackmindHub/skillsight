import { recordAudit } from "@/application/audit/record-audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";

export const DELETE_MARKETPLACES_MAX_BATCH = 100;

export type DeleteMarketplacesMode = "orphan" | "cascade";

export type DeleteMarketplaceItemOutcome =
	| { name: string; outcome: "deleted"; affectedPluginNames: string[]; deletedSourceIds: string[] }
	| { name: string; outcome: "not_found" }
	| { name: string; outcome: "linked_sources"; sourceIds: string[] };

export interface DeleteMarketplacesInput {
	names: string[];
	mode: DeleteMarketplacesMode;
	withSources: boolean;
	actorEmail: string | null;
}

export type DeleteMarketplacesResult =
	| {
			deleted: number;
			notFound: number;
			blocked: number;
			deletedSourceIds: string[];
			items: DeleteMarketplaceItemOutcome[];
	  }
	| { error: "empty" | "too_many" };

export async function deleteMarketplaces(
	deps: {
		marketplaces: IMarketplaceRepository;
		marketplaceSources: IMarketplaceSourceRepository;
		plugins: IPluginRepository;
		pluginSkills: IPluginSkillRepository;
		skills: ISkillRepository;
		audit: IAuditRepository;
	},
	input: DeleteMarketplacesInput,
): Promise<DeleteMarketplacesResult> {
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const raw of input.names) {
		const name = raw?.trim();
		if (!name) continue;
		if (seen.has(name)) continue;
		seen.add(name);
		normalized.push(name);
	}

	if (normalized.length === 0) return { error: "empty" };
	if (normalized.length > DELETE_MARKETPLACES_MAX_BATCH) return { error: "too_many" };

	const items: DeleteMarketplaceItemOutcome[] = [];
	const allDeletedSourceIds: string[] = [];
	let deleted = 0;
	let notFound = 0;
	let blocked = 0;

	for (const name of normalized) {
		const existing = await deps.marketplaces.findByName(name);
		if (!existing) {
			notFound++;
			items.push({ name, outcome: "not_found" });
			continue;
		}

		const linkedSources = await deps.marketplaceSources.findByMarketplaceName(name);
		if (linkedSources.length > 0 && !input.withSources) {
			blocked++;
			items.push({
				name,
				outcome: "linked_sources",
				sourceIds: linkedSources.map((s) => s.id),
			});
			continue;
		}

		const deletedSourceIds: string[] = [];
		for (const source of linkedSources) {
			await deps.marketplaceSources.delete(source.id);
			deletedSourceIds.push(source.id);
		}

		let affectedPluginNames: string[];
		if (input.mode === "cascade") {
			const pluginNames = await deps.plugins.listNamesByMarketplace(name);
			await deps.pluginSkills.deleteByPlugins(pluginNames);
			await deps.skills.deleteByPlugins(pluginNames);
			affectedPluginNames = await deps.plugins.deleteByMarketplace(name);
		} else {
			affectedPluginNames = await deps.plugins.orphanByMarketplace(name);
		}

		await deps.marketplaces.delete(name);

		deleted++;
		allDeletedSourceIds.push(...deletedSourceIds);
		items.push({ name, outcome: "deleted", affectedPluginNames, deletedSourceIds });
	}

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "marketplaces_deleted",
		target: null,
		metadata: {
			requested: normalized.length,
			deleted,
			notFound,
			blocked,
			mode: input.mode,
			withSources: input.withSources,
			deletedSourceCount: allDeletedSourceIds.length,
			items: items.slice(0, 50),
		},
	});

	return { deleted, notFound, blocked, deletedSourceIds: allDeletedSourceIds, items };
}
