import { and, count, eq } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { events, integrations } from "@/db/schema";
import { encrypt } from "@/infrastructure/crypto/encrypt";
import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type {
	IntegrationWithSecret,
	CreateIntegrationData,
	UpdateIntegrationData,
} from "@/domain/integration";

function toIntegrationWithSecret(
	row: typeof integrations.$inferSelect,
): IntegrationWithSecret {
	return {
		id: row.id,
		type: row.type,
		name: row.name,
		url: row.url,
		authType: row.authType as "none" | "basic",
		authUsername: row.authUsername,
		hasPassword: row.authPasswordEncrypted !== null,
		authPasswordEncrypted: row.authPasswordEncrypted,
		lokiQuery: row.lokiQuery,
		syncIntervalMs: row.syncIntervalMs,
		enabled: row.enabled,
		lastSyncAt: row.lastSyncAt,
		lastSyncError: row.lastSyncError,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export class DrizzleIntegrationRepository implements IIntegrationRepository {
	constructor(private readonly db: AppDb) {}

	async findAll(): Promise<IntegrationWithSecret[]> {
		const rows = await this.db.select().from(integrations).orderBy(integrations.createdAt);
		return rows.map(toIntegrationWithSecret);
	}

	async findById(id: string): Promise<IntegrationWithSecret | null> {
		const [row] = await this.db
			.select()
			.from(integrations)
			.where(eq(integrations.id, id))
			.limit(1);
		return row ? toIntegrationWithSecret(row) : null;
	}

	async create(data: CreateIntegrationData): Promise<IntegrationWithSecret> {
		const authPasswordEncrypted =
			data.authType === "basic" && data.authPassword ? encrypt(data.authPassword) : null;

		const [row] = await this.db
			.insert(integrations)
			.values({
				name: data.name,
				url: data.url,
				authType: data.authType,
				authUsername: data.authUsername ?? null,
				authPasswordEncrypted,
				lokiQuery: data.lokiQuery,
				syncIntervalMs: data.syncIntervalMs,
				enabled: data.enabled,
			})
			.returning();
		return toIntegrationWithSecret(row);
	}

	async update(id: string, data: UpdateIntegrationData): Promise<IntegrationWithSecret> {
		const existing = await this.findById(id);
		if (!existing) throw new Error(`Integration ${id} not found`);

		let authPasswordEncrypted = existing.authPasswordEncrypted;
		if (data.authType === "none") {
			authPasswordEncrypted = null;
		} else if (data.authPassword) {
			authPasswordEncrypted = encrypt(data.authPassword);
		}

		const [row] = await this.db
			.update(integrations)
			.set({
				...(data.name !== undefined && { name: data.name }),
				...(data.url !== undefined && { url: data.url }),
				...(data.authType !== undefined && { authType: data.authType }),
				...(data.authUsername !== undefined && { authUsername: data.authUsername ?? null }),
				authPasswordEncrypted,
				...(data.lokiQuery !== undefined && { lokiQuery: data.lokiQuery }),
				...(data.syncIntervalMs !== undefined && { syncIntervalMs: data.syncIntervalMs }),
				...(data.enabled !== undefined && { enabled: data.enabled }),
				updatedAt: new Date(),
			})
			.where(eq(integrations.id, id))
			.returning();
		return toIntegrationWithSecret(row);
	}

	async delete(id: string): Promise<void> {
		await this.db.delete(integrations).where(eq(integrations.id, id));
	}

	async updateSyncStatus(
		id: string,
		status: { lastSyncAt?: Date | null; lastSyncError?: string | null },
	): Promise<void> {
		const now = new Date();
		await this.db
			.update(integrations)
			.set({
				...(status.lastSyncAt !== undefined && { lastSyncAt: status.lastSyncAt }),
				...(status.lastSyncError !== undefined && { lastSyncError: status.lastSyncError }),
				updatedAt: now,
			})
			.where(eq(integrations.id, id));
	}

	async countEventsByIntegration(): Promise<Map<string, number>> {
		const counts = await this.db
			.select({ integrationId: events.sourceIntegrationId, cnt: count() })
			.from(events)
			.where(eq(events.source, "integration"))
			.groupBy(events.sourceIntegrationId);
		return new Map(counts.map((r) => [r.integrationId ?? "", Number(r.cnt)]));
	}

	async countEventsByIntegrationId(id: string): Promise<number> {
		const [row] = await this.db
			.select({ cnt: count() })
			.from(events)
			.where(and(eq(events.source, "integration"), eq(events.sourceIntegrationId, id)));
		return Number(row?.cnt ?? 0);
	}
}
