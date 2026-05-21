import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { marketplaces } from "@/db/schema";
import { EVENT_NAMES } from "@/domain/event";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type {
	Marketplace,
	MarketplacePluginRow,
	MarketplaceProvider,
	MarketplaceSkillRow,
	MarketplaceStatus,
	MarketplaceWithStats,
} from "@/domain/marketplace";

export class DrizzleMarketplaceRepository implements IMarketplaceRepository {
	constructor(private readonly db: AppDb) {}

	async listWithStats(includeIgnored = false): Promise<MarketplaceWithStats[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  m.name,
			  m.status,
			  m.provider,
			  m.url,
			  m.description,
			  m.first_seen_at AS "firstSeenAt",
			  m.last_seen_at AS "lastSeenAt",
			  COALESCE(stats.count, 0)::int AS "activationCount",
			  COALESCE(installs.count, 0)::int AS "pluginInstallCount",
			  COALESCE(linked.count, 0)::int AS "skillActivatedLinkedCount",
			  COALESCE(p.plugin_count, 0)::int AS "pluginCount",
			  COALESCE(skills_agg.known_skill_count, 0)::int AS "knownSkillCount",
			  COALESCE(skills_agg.activated_skill_count, 0)::int AS "activatedSkillCount",
			  COALESCE(skills_agg.total_activation_count, 0)::int AS "totalActivationCount"
			FROM marketplaces m
			LEFT JOIN (
			  SELECT attributes->>'marketplace.name' AS mp_name, COUNT(*)::int AS count
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			    AND timestamp >= NOW() - INTERVAL '30 days'
			    AND attributes->>'marketplace.name' IS NOT NULL
			  GROUP BY mp_name
			) stats ON stats.mp_name = m.name
			LEFT JOIN (
			  SELECT attributes->>'marketplace.name' AS mp_name, COUNT(*)::int AS count
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_INSTALLED}
			    AND attributes->>'marketplace.name' IS NOT NULL
			  GROUP BY mp_name
			) installs ON installs.mp_name = m.name
			LEFT JOIN (
			  SELECT pl.marketplace_name, COUNT(*)::int AS count
			  FROM events e
			  JOIN plugin_skills ps ON ps.skill_name = e.attributes->>'skill.name'
			  JOIN plugins pl ON pl.plugin_name = ps.plugin_name
			  WHERE e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			    AND e.attributes->>'skill.name' IS NOT NULL
			  GROUP BY pl.marketplace_name
			) linked ON linked.marketplace_name = m.name
			LEFT JOIN (
			  SELECT marketplace_name, COUNT(*)::int AS plugin_count
			  FROM plugins
			  WHERE marketplace_name IS NOT NULL
			  GROUP BY marketplace_name
			) p ON p.marketplace_name = m.name
			LEFT JOIN (
			  SELECT
			    pl.marketplace_name,
			    COUNT(DISTINCT ps.skill_name)::int AS known_skill_count,
			    COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN ps.skill_name END)::int AS activated_skill_count,
			    COUNT(e.id)::int AS total_activation_count
			  FROM plugins pl
			  JOIN plugin_skills ps ON ps.plugin_name = pl.plugin_name
			  LEFT JOIN events e
			    ON e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			   AND e.attributes->>'skill.name' = ps.skill_name
			  WHERE pl.marketplace_name IS NOT NULL
			  GROUP BY pl.marketplace_name
			) skills_agg ON skills_agg.marketplace_name = m.name
			${includeIgnored ? sql`` : sql`WHERE m.status <> 'ignored'`}
			ORDER BY "activationCount" DESC, m.name
		`);
		return rows as unknown as MarketplaceWithStats[];
	}

	async listPluginsForMarketplace(name: string): Promise<MarketplacePluginRow[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  p.plugin_name             AS "pluginName",
			  p.status                  AS "status",
			  p.plugin_version          AS "pluginVersion",
			  COALESCE(s.install_count, 0)::int     AS "installationCount",
			  COALESCE(sa.activation_count, 0)::int AS "skillActivationCount"
			FROM plugins p
			LEFT JOIN (
			  SELECT
			    attributes->>'plugin.name' AS plugin_name,
			    COUNT(*)::int              AS install_count
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_INSTALLED}
			    AND attributes->>'plugin.name' IS NOT NULL
			  GROUP BY attributes->>'plugin.name'
			) s ON s.plugin_name = p.plugin_name
			LEFT JOIN (
			  SELECT ps.plugin_name AS plugin_name, COUNT(e.id)::int AS activation_count
			  FROM plugin_skills ps
			  LEFT JOIN events e
			    ON e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			   AND e.attributes->>'skill.name' = ps.skill_name
			  GROUP BY ps.plugin_name
			) sa ON sa.plugin_name = p.plugin_name
			WHERE p.marketplace_name = ${name}
			ORDER BY "skillActivationCount" DESC, p.plugin_name
		`);
		return rows as unknown as MarketplacePluginRow[];
	}

	async listSkillsForMarketplace(name: string): Promise<MarketplaceSkillRow[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  ps.skill_name    AS "skillName",
			  ps.plugin_name   AS "pluginName",
			  COUNT(e.id)::int AS "activationCount"
			FROM plugin_skills ps
			JOIN plugins pl ON pl.plugin_name = ps.plugin_name
			LEFT JOIN events e
			  ON e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			 AND e.attributes->>'skill.name' = ps.skill_name
			WHERE pl.marketplace_name = ${name}
			GROUP BY ps.skill_name, ps.plugin_name
			ORDER BY "activationCount" DESC, ps.skill_name
		`);
		return rows as unknown as MarketplaceSkillRow[];
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
			provider: (row.provider as MarketplaceProvider) ?? "git",
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
			provider: (row.provider as MarketplaceProvider) ?? "git",
			url: row.url,
			description: row.description,
			firstSeenAt: row.firstSeenAt,
			lastSeenAt: row.lastSeenAt,
		};
	}

	async upsertFromImport(data: {
		name: string;
		provider?: MarketplaceProvider;
		url?: string | null;
		description?: string | null;
	}): Promise<void> {
		const now = new Date();
		const provider = data.provider ?? "git";
		await this.db
			.insert(marketplaces)
			.values({
				name: data.name,
				status: "approved",
				provider,
				url: data.url ?? null,
				description: data.description ?? null,
				firstSeenAt: now,
				lastSeenAt: now,
			})
			.onConflictDoUpdate({
				target: marketplaces.name,
				set: {
					provider,
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

	async delete(name: string): Promise<boolean> {
		const rows = await this.db
			.delete(marketplaces)
			.where(eq(marketplaces.name, name))
			.returning({ name: marketplaces.name });
		return rows.length > 0;
	}
}
