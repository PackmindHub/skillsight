import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { marketplaces } from "@/db/schema";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { Marketplace, MarketplaceStatus, MarketplaceWithStats } from "@/domain/marketplace";

export class DrizzleMarketplaceRepository implements IMarketplaceRepository {
	constructor(private readonly db: AppDb) {}

	async listWithStats(): Promise<MarketplaceWithStats[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  m.name,
			  m.status,
			  m.url,
			  m.description,
			  m.first_seen_at AS "firstSeenAt",
			  m.last_seen_at AS "lastSeenAt",
			  COALESCE(stats.count, 0)::int AS "activationCount",
			  COALESCE(installs.count, 0)::int AS "pluginInstallCount",
			  COALESCE(linked.count, 0)::int AS "skillActivatedLinkedCount"
			FROM marketplaces m
			LEFT JOIN (
			  SELECT attributes->>'marketplace.name' AS mp_name, COUNT(*)::int AS count
			  FROM events
			  WHERE event_name = 'claude_code.skill_activated'
			    AND timestamp >= NOW() - INTERVAL '30 days'
			    AND attributes->>'marketplace.name' IS NOT NULL
			  GROUP BY mp_name
			) stats ON stats.mp_name = m.name
			LEFT JOIN (
			  SELECT attributes->>'marketplace.name' AS mp_name, COUNT(*)::int AS count
			  FROM events
			  WHERE event_name = 'claude_code.plugin_installed'
			    AND attributes->>'marketplace.name' IS NOT NULL
			  GROUP BY mp_name
			) installs ON installs.mp_name = m.name
			LEFT JOIN (
			  SELECT pl.marketplace_name, COUNT(*)::int AS count
			  FROM events e
			  JOIN plugin_skills ps ON ps.skill_name = e.attributes->>'skill.name'
			  JOIN plugins pl ON pl.plugin_name = ps.plugin_name
			  WHERE e.event_name = 'claude_code.skill_activated'
			    AND e.attributes->>'skill.name' IS NOT NULL
			  GROUP BY pl.marketplace_name
			) linked ON linked.marketplace_name = m.name
			ORDER BY "activationCount" DESC, m.name
		`);
		return rows as unknown as MarketplaceWithStats[];
	}

	async findByName(name: string): Promise<Marketplace | null> {
		const [row] = await this.db
			.select()
			.from(marketplaces)
			.where(eq(marketplaces.name, name));
		if (!row) return null;
		return {
			name: row.name,
			status: row.status as MarketplaceStatus,
			url: row.url,
			description: row.description,
			firstSeenAt: row.firstSeenAt,
			lastSeenAt: row.lastSeenAt,
		};
	}

	async update(
		name: string,
		data: Partial<Pick<Marketplace, "status" | "url" | "description">>,
	): Promise<Marketplace> {
		const updates: Partial<typeof marketplaces.$inferInsert> = {};
		if (data.status !== undefined) updates.status = data.status;
		if (data.url !== undefined) updates.url = data.url;
		if (data.description !== undefined) updates.description = data.description;

		const [row] = await this.db
			.update(marketplaces)
			.set(updates)
			.where(eq(marketplaces.name, name))
			.returning();
		return {
			name: row.name,
			status: row.status as MarketplaceStatus,
			url: row.url,
			description: row.description,
			firstSeenAt: row.firstSeenAt,
			lastSeenAt: row.lastSeenAt,
		};
	}

	async upsertFromImport(data: {
		name: string;
		url?: string | null;
		description?: string | null;
	}): Promise<void> {
		const now = new Date();
		await this.db
			.insert(marketplaces)
			.values({
				name: data.name,
				status: "approved",
				url: data.url ?? null,
				description: data.description ?? null,
				firstSeenAt: now,
				lastSeenAt: now,
			})
			.onConflictDoUpdate({
				target: marketplaces.name,
				set: {
					url: data.url ?? null,
					description: data.description ?? null,
					lastSeenAt: now,
				},
			});
	}

	async upsertSeen(names: string[]): Promise<void> {
		if (names.length === 0) return;
		const now = new Date();
		await this.db
			.insert(marketplaces)
			.values(names.map((name) => ({ name, lastSeenAt: now })))
			.onConflictDoUpdate({
				target: marketplaces.name,
				set: { lastSeenAt: now },
			});
	}

	async listStatuses(): Promise<Array<{ name: string; status: MarketplaceStatus }>> {
		const rows = await this.db
			.select({ name: marketplaces.name, status: marketplaces.status })
			.from(marketplaces);
		return rows.map((r) => ({ name: r.name, status: r.status as MarketplaceStatus }));
	}
}
