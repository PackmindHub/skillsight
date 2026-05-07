import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { MarketplaceSource, UpdateMarketplaceSourceData } from "@/domain/marketplace-source";
import { encrypt } from "@/infrastructure/crypto/encrypt";

export async function updateMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository },
	id: string,
	data: UpdateMarketplaceSourceData,
): Promise<MarketplaceSource | null> {
	const existing = await deps.marketplaceSources.findById(id);
	if (!existing) return null;

	const updates: Parameters<IMarketplaceSourceRepository["update"]>[1] = {};
	if (data.gitUrl !== undefined) updates.gitUrl = data.gitUrl;
	if (data.branch !== undefined) updates.branch = data.branch || null;
	if (data.syncIntervalMs !== undefined) updates.syncIntervalMs = data.syncIntervalMs;
	if (data.enabled !== undefined) updates.enabled = data.enabled;
	if (data.importPluginsAndSkills !== undefined) updates.importPluginsAndSkills = data.importPluginsAndSkills;

	// null = clear token, string = new token, undefined = keep existing
	if (data.accessToken === null) {
		updates.accessTokenEncrypted = null;
	} else if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
		updates.accessTokenEncrypted = encrypt(data.accessToken);
	}

	return deps.marketplaceSources.update(id, updates);
}
