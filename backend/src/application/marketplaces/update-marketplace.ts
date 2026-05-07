import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { Marketplace, MarketplaceStatus } from "@/domain/marketplace";
import { eventBus } from "@/lib/event-bus";

export async function updateMarketplace(
	deps: { marketplaces: IMarketplaceRepository; audit: IAuditRepository },
	input: {
		name: string;
		status?: MarketplaceStatus;
		url?: string | null;
		description?: string | null;
		actorEmail: string | null;
	},
): Promise<Marketplace | { error: "not_found" }> {
	const existing = await deps.marketplaces.findByName(input.name);
	if (!existing) return { error: "not_found" };

	const updates: Partial<Pick<Marketplace, "status" | "url" | "description">> = {};
	if (input.status !== undefined) updates.status = input.status;
	if (input.url !== undefined) updates.url = input.url;
	if (input.description !== undefined) updates.description = input.description;

	const updated = await deps.marketplaces.update(input.name, updates);

	if (input.status !== undefined && input.status !== existing.status) {
		await deps.audit.log({
			actorEmail: input.actorEmail,
			action: "marketplace_status_changed",
			target: input.name,
			metadata: { from: existing.status, to: input.status },
		});
		eventBus.emitMarketplaceStatusChanged({ name: input.name, newStatus: input.status });
	} else if (Object.keys(updates).length > 0) {
		await deps.audit.log({
			actorEmail: input.actorEmail,
			action: "marketplace_updated",
			target: input.name,
			metadata: updates as Record<string, unknown>,
		});
	}

	return updated;
}
