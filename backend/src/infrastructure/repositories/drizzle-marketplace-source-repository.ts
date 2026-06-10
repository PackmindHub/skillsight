import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { marketplaceSources } from "@/db/schema";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type {
	GitProvider,
	MarketplaceSource,
	MarketplaceSourceKind,
	MarketplaceSourceWithSecret,
} from "@/domain/marketplace-source";

function toPublic(row: typeof marketplaceSources.$inferSelect): MarketplaceSource {
	return {
		id: row.id,
		kind: (row.kind as MarketplaceSourceKind) ?? "git",
		gitUrl: row.gitUrl,
		provider: (row.provider as GitProvider) ?? "auto",
		hasToken: row.accessTokenEncrypted !== null,
		branch: row.branch,
		marketplaceName: row.marketplaceName,
		syncIntervalMs: row.syncIntervalMs,
		enabled: row.enabled,
		importPluginsAndSkills: row.importPluginsAndSkills,
		lastSyncAt: row.lastSyncAt,
		lastSyncError: row.lastSyncError,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toWithSecret(row: typeof marketplaceSources.$inferSelect): MarketplaceSourceWithSecret {
	return {
		...toPublic(row),
		accessTokenEncrypted: row.accessTokenEncrypted,
	};
}

export class DrizzleMarketplaceSourceRepository implements IMarketplaceSourceRepository {
	constructor(private readonly db: AppDb) {}

	async findAll(): Promise<MarketplaceSourceWithSecret[]> {
		const rows = await this.db.select().from(marketplaceSources).orderBy(marketplaceSources.createdAt);
		return rows.map(toWithSecret);
	}

	async findById(id: string): Promise<MarketplaceSourceWithSecret | null> {
		const [row] = await this.db.select().from(marketplaceSources).where(eq(marketplaceSources.id, id));
		return row ? toWithSecret(row) : null;
	}

	async findByMarketplaceName(name: string): Promise<MarketplaceSource[]> {
		const rows = await this.db
			.select()
			.from(marketplaceSources)
			.where(eq(marketplaceSources.marketplaceName, name));
		return rows.map(toPublic);
	}

	async create(data: {
		kind: MarketplaceSourceKind;
		gitUrl?: string | null;
		provider?: GitProvider;
		marketplaceName?: string | null;
		accessTokenEncrypted?: string | null;
		branch?: string | null;
		syncIntervalMs: number;
		enabled: boolean;
		importPluginsAndSkills?: boolean;
	}): Promise<MarketplaceSource> {
		const [row] = await this.db
			.insert(marketplaceSources)
			.values({
				kind: data.kind,
				gitUrl: data.gitUrl ?? null,
				provider: data.provider ?? "auto",
				marketplaceName: data.marketplaceName ?? null,
				accessTokenEncrypted: data.accessTokenEncrypted ?? null,
				branch: data.branch ?? null,
				syncIntervalMs: data.syncIntervalMs,
				enabled: data.enabled,
				importPluginsAndSkills: data.importPluginsAndSkills ?? false,
			})
			.returning();
		return toPublic(row);
	}

	async update(
		id: string,
		data: {
			gitUrl?: string | null;
			provider?: GitProvider;
			marketplaceName?: string | null;
			accessTokenEncrypted?: string | null;
			branch?: string | null;
			syncIntervalMs?: number;
			enabled?: boolean;
			importPluginsAndSkills?: boolean;
		},
	): Promise<MarketplaceSource> {
		const updates: Partial<typeof marketplaceSources.$inferInsert> = {
			updatedAt: new Date(),
		};
		if ("gitUrl" in data) updates.gitUrl = data.gitUrl;
		if (data.provider !== undefined) updates.provider = data.provider;
		if ("marketplaceName" in data) updates.marketplaceName = data.marketplaceName;
		if ("accessTokenEncrypted" in data) updates.accessTokenEncrypted = data.accessTokenEncrypted;
		if ("branch" in data) updates.branch = data.branch;
		if (data.syncIntervalMs !== undefined) updates.syncIntervalMs = data.syncIntervalMs;
		if (data.enabled !== undefined) updates.enabled = data.enabled;
		if (data.importPluginsAndSkills !== undefined)
			updates.importPluginsAndSkills = data.importPluginsAndSkills;

		const [row] = await this.db
			.update(marketplaceSources)
			.set(updates)
			.where(eq(marketplaceSources.id, id))
			.returning();
		return toPublic(row);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(marketplaceSources).where(eq(marketplaceSources.id, id));
	}

	async updateSyncStatus(
		id: string,
		data: {
			lastSyncAt?: Date | null;
			lastSyncError?: string | null;
			marketplaceName?: string | null;
		},
	): Promise<void> {
		const updates: Partial<typeof marketplaceSources.$inferInsert> = {
			updatedAt: new Date(),
		};
		if ("lastSyncAt" in data) updates.lastSyncAt = data.lastSyncAt ?? undefined;
		if ("lastSyncError" in data) updates.lastSyncError = data.lastSyncError;
		if ("marketplaceName" in data) updates.marketplaceName = data.marketplaceName;
		await this.db.update(marketplaceSources).set(updates).where(eq(marketplaceSources.id, id));
	}
}
