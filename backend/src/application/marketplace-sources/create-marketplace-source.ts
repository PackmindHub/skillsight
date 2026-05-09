import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { MarketplaceSource, CreateMarketplaceSourceData } from "@/domain/marketplace-source";
import { encrypt } from "@/infrastructure/crypto/encrypt";
import { recordAudit } from "@/application/audit/record-audit";

export async function createMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository; audit: IAuditRepository },
	data: CreateMarketplaceSourceData & { actorEmail?: string | null },
): Promise<MarketplaceSource> {
	const accessTokenEncrypted = data.accessToken ? encrypt(data.accessToken) : null;
	const created = await deps.marketplaceSources.create({
		gitUrl: data.gitUrl,
		accessTokenEncrypted,
		branch: data.branch ?? null,
		syncIntervalMs: data.syncIntervalMs ?? 3600000,
		enabled: data.enabled ?? true,
		importPluginsAndSkills: data.importPluginsAndSkills ?? false,
	});

	await recordAudit(deps, {
		actorEmail: data.actorEmail ?? null,
		action: "marketplace_source_created",
		target: created.id,
		metadata: {
			gitUrl: created.gitUrl,
			branch: created.branch,
			syncIntervalMs: created.syncIntervalMs,
			enabled: created.enabled,
			importPluginsAndSkills: created.importPluginsAndSkills,
			hasToken: created.hasToken,
		},
	});

	return created;
}
