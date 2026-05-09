import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import { recordAudit } from "@/application/audit/record-audit";

export async function deleteMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository; audit: IAuditRepository },
	id: string,
	options?: { actorEmail?: string | null },
): Promise<boolean> {
	const existing = await deps.marketplaceSources.findById(id);
	if (!existing) return false;
	await deps.marketplaceSources.delete(id);

	await recordAudit(deps, {
		actorEmail: options?.actorEmail ?? null,
		action: "marketplace_source_deleted",
		target: id,
		metadata: {
			gitUrl: existing.gitUrl,
			branch: existing.branch,
			marketplaceName: existing.marketplaceName,
		},
	});

	return true;
}
