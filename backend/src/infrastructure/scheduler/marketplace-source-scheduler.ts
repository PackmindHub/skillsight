import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";

type SyncFn = (source: MarketplaceSourceWithSecret) => Promise<unknown>;

const g = globalThis as Record<string, unknown>;
const handles = (g.__msHandles ??= new Map<string, ReturnType<typeof setInterval>>()) as Map<
	string,
	ReturnType<typeof setInterval>
>;

export async function startMarketplaceSourceScheduler(
	repo: IMarketplaceSourceRepository,
	syncFn: SyncFn,
): Promise<void> {
	const sources = await repo.findAll();
	const enabled = sources.filter((s) => s.enabled);
	for (const source of enabled) {
		scheduleMarketplaceSource(source, syncFn);
	}
	console.log(`[marketplace-scheduler] Started ${enabled.length} marketplace source(s)`);
}

export function scheduleMarketplaceSource(source: MarketplaceSourceWithSecret, syncFn: SyncFn): void {
	cancelMarketplaceSource(source.id);
	const handle = setInterval(async () => {
		await syncFn(source).catch(() => {});
	}, source.syncIntervalMs);
	handles.set(source.id, handle);
}

export async function rescheduleMarketplaceSource(
	id: string,
	repo: IMarketplaceSourceRepository,
	syncFn: SyncFn,
): Promise<void> {
	cancelMarketplaceSource(id);
	const source = await repo.findById(id);
	if (source?.enabled) {
		scheduleMarketplaceSource(source, syncFn);
	}
}

export function cancelMarketplaceSource(id: string): void {
	const handle = handles.get(id);
	if (handle !== undefined) {
		clearInterval(handle);
		handles.delete(id);
	}
}
