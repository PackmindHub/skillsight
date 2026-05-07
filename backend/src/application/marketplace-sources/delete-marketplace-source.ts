import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";

export async function deleteMarketplaceSource(
	deps: { marketplaceSources: IMarketplaceSourceRepository },
	id: string,
): Promise<boolean> {
	const existing = await deps.marketplaceSources.findById(id);
	if (!existing) return false;
	await deps.marketplaceSources.delete(id);
	return true;
}
