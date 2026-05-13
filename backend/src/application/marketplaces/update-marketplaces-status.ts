import { recordAudit } from "@/application/audit/record-audit";
import type { MarketplaceStatus } from "@/domain/marketplace";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import { eventBus } from "@/lib/event-bus";

export const UPDATE_MARKETPLACES_STATUS_MAX_BATCH = 100;

export interface UpdateMarketplacesStatusInput {
	names: string[];
	status: MarketplaceStatus;
	actorEmail: string | null;
}

export type UpdateMarketplacesStatusResult =
	| { updated: number; notFound: number; unchanged: number }
	| { error: "empty" | "too_many" };

export async function updateMarketplacesStatus(
	deps: { marketplaces: IMarketplaceRepository; audit: IAuditRepository },
	input: UpdateMarketplacesStatusInput,
): Promise<UpdateMarketplacesStatusResult> {
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
	if (normalized.length > UPDATE_MARKETPLACES_STATUS_MAX_BATCH) return { error: "too_many" };

	let updated = 0;
	let notFound = 0;
	let unchanged = 0;
	const changed: string[] = [];

	for (const name of normalized) {
		const existing = await deps.marketplaces.findByName(name);
		if (!existing) {
			notFound++;
			continue;
		}
		if (existing.status === input.status) {
			unchanged++;
			continue;
		}
		await deps.marketplaces.update(name, { status: input.status });
		updated++;
		changed.push(name);
		eventBus.emitMarketplaceStatusChanged({
			name,
			newStatus: input.status,
			actorEmail: input.actorEmail,
		});
	}

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "marketplaces_status_changed",
		target: null,
		metadata: {
			to: input.status,
			requested: normalized.length,
			updated,
			notFound,
			unchanged,
			scope: "bulk",
			marketplaces: changed.slice(0, 50),
		},
	});

	return { updated, notFound, unchanged };
}
