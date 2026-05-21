import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditAction } from "@/domain/audit";
import type { MarketplaceSource, UpdateMarketplaceSourceData } from "@/domain/marketplace-source";
import { encrypt } from "@/infrastructure/crypto/encrypt";
import { recordAudit } from "@/application/audit/record-audit";
import { buildDiff } from "@/application/audit/diff";

const DIFF_FIELDS = [
	"gitUrl",
	"branch",
	"syncIntervalMs",
	"enabled",
	"importPluginsAndSkills",
	"hasToken",
] as const;

export interface UpdateMarketplaceSourceOptions {
	auditAction?: AuditAction;
}

export async function updateMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository; audit: IAuditRepository },
	id: string,
	data: UpdateMarketplaceSourceData & { actorEmail?: string | null },
	options: UpdateMarketplaceSourceOptions = {},
): Promise<MarketplaceSource | null> {
	const existing = await deps.marketplaceSources.findById(id);
	if (!existing) return null;

	const updates: Parameters<IMarketplaceSourceRepository["update"]>[1] = {};
	if (data.gitUrl !== undefined) updates.gitUrl = data.gitUrl;
	if (data.marketplaceName !== undefined) updates.marketplaceName = data.marketplaceName || null;
	if (data.branch !== undefined) updates.branch = data.branch || null;
	if (data.syncIntervalMs !== undefined) updates.syncIntervalMs = data.syncIntervalMs;
	if (data.enabled !== undefined) updates.enabled = data.enabled;
	if (data.importPluginsAndSkills !== undefined)
		updates.importPluginsAndSkills = data.importPluginsAndSkills;

	// null = clear token, string = new token, undefined = keep existing
	if (data.accessToken === null) {
		updates.accessTokenEncrypted = null;
	} else if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
		updates.accessTokenEncrypted = encrypt(data.accessToken);
	}

	const updated = await deps.marketplaceSources.update(id, updates);
	if (!updated) return updated;

	const beforeView = {
		gitUrl: existing.gitUrl,
		branch: existing.branch,
		syncIntervalMs: existing.syncIntervalMs,
		enabled: existing.enabled,
		importPluginsAndSkills: existing.importPluginsAndSkills,
		hasToken: existing.hasToken,
	};
	const afterView = {
		gitUrl: updated.gitUrl,
		branch: updated.branch,
		syncIntervalMs: updated.syncIntervalMs,
		enabled: updated.enabled,
		importPluginsAndSkills: updated.importPluginsAndSkills,
		hasToken: updated.hasToken,
	};
	const diff = buildDiff(beforeView, afterView, DIFF_FIELDS);
	const action = options.auditAction ?? "marketplace_source_updated";
	if (diff || action !== "marketplace_source_updated") {
		await recordAudit(deps, {
			actorEmail: data.actorEmail ?? null,
			action,
			target: id,
			metadata: diff ?? {},
		});
	}

	return updated;
}
