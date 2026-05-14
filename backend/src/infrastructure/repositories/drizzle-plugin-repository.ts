import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { plugins } from "@/db/schema";
import { EVENT_NAMES } from "@/domain/event";
import { maxSemver } from "@/lib/semver";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { TimeWindow } from "@/domain/ports/skill-repository";
import type {
	NewPlugin,
	Plugin,
	PluginLoadStats,
	PluginSkillActivation,
	PluginStatus,
	PluginUserActivation,
	PluginWeeklyLoaders,
	PluginWeeklyLoadersBucket,
	PluginWithStats,
} from "@/domain/plugin";

// Mirrors the helper in drizzle-skill-repository — kept inline to avoid
// coupling the two repos through a shared util.
function timeFilter(window: TimeWindow) {
	if (window.kind === "range") {
		return sql`AND timestamp >= ${window.from.toISOString()}::timestamp AND timestamp < ${window.to.toISOString()}::timestamp`;
	}
	if (window.days === "all") return sql``;
	return sql`AND timestamp >= NOW() - (${window.days} || ' days')::interval`;
}

export class DrizzlePluginRepository implements IPluginRepository {
	constructor(private readonly db: AppDb) {}

	async listWithStats(includeIgnored = false): Promise<PluginWithStats[]> {
		// loadCount / uniqueLoaderCount come from `claude_code.plugin_loaded`.
		// The join keys on (plugin.name, marketplace.name) — `NULLIF(..., 'inline')`
		// mirrors `normalizeMarketplaceName` so events tagged with the synthetic
		// "inline" marketplace bucket join the NULL-marketplace plugin row.
		// Redacted rows (`plugin.name = 'third-party'`) are excluded because they
		// can't be attributed to a specific catalog entry.
		const rows = await this.db.execute(sql`
			SELECT
			  p.plugin_name             AS "pluginName",
			  p.marketplace_name        AS "marketplaceName",
			  p.plugin_version          AS "pluginVersion",
			  p.install_trigger         AS "installTrigger",
			  p.marketplace_is_official AS "marketplaceIsOfficial",
			  p.source                  AS "source",
			  p.status,
			  m.status                  AS "marketplaceStatus",
			  p.first_seen_at           AS "firstSeenAt",
			  p.last_seen_at            AS "lastSeenAt",
			  COALESCE(s.install_count, 0)::int AS "installationCount",
			  COALESCE(s.unique_users, 0)::int  AS "uniqueUserCount",
			  COALESCE(ps.skill_count, 0)::int  AS "skillCount",
			  COALESCE(sa.activation_count, 0)::int AS "skillActivationCount",
			  sa.last_activation_at             AS "lastSkillActivationAt",
			  COALESCE(l.load_count, 0)::int    AS "loadCount",
			  COALESCE(l.unique_loaders, 0)::int AS "uniqueLoaderCount",
			  COALESCE(v.versions, ARRAY[]::text[]) AS "versionStrings"
			FROM plugins p
			LEFT JOIN marketplaces m ON m.name = p.marketplace_name
			LEFT JOIN (
			  SELECT
			    attributes->>'plugin.name'      AS plugin_name,
			    COUNT(*)::int                   AS install_count,
			    COUNT(DISTINCT user_email)::int AS unique_users
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_INSTALLED}
			    AND attributes->>'plugin.name' IS NOT NULL
			  GROUP BY attributes->>'plugin.name'
			) s ON s.plugin_name = p.plugin_name
			LEFT JOIN (
			  SELECT plugin_name, COUNT(*)::int AS skill_count
			  FROM plugin_skills
			  GROUP BY plugin_name
			) ps ON ps.plugin_name = p.plugin_name
			LEFT JOIN (
			  SELECT
			    ps.plugin_name           AS plugin_name,
			    COUNT(e.id)::int         AS activation_count,
			    MAX(e.timestamp)         AS last_activation_at
			  FROM plugin_skills ps
			  LEFT JOIN events e
			    ON e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			   AND e.attributes->>'skill.name' = ps.skill_name
			   AND e.attributes->>'plugin.name' = ps.plugin_name
			  GROUP BY ps.plugin_name
			) sa ON sa.plugin_name = p.plugin_name
			LEFT JOIN (
			  SELECT
			    attributes->>'plugin.name'                   AS plugin_name,
			    NULLIF(attributes->>'marketplace.name', 'inline') AS marketplace_name,
			    COUNT(*)::int                                AS load_count,
			    COUNT(DISTINCT user_email)::int              AS unique_loaders
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
			    AND attributes->>'plugin.name' IS NOT NULL
			    AND attributes->>'plugin.name' <> 'third-party'
			  GROUP BY 1, 2
			) l
			  ON l.plugin_name = p.plugin_name
			 AND COALESCE(l.marketplace_name, '') = COALESCE(p.marketplace_name, '')
			LEFT JOIN (
			  SELECT
			    plugin_name,
			    marketplace_name,
			    array_agg(version ORDER BY last_seen_at DESC) AS versions
			  FROM plugin_versions
			  GROUP BY plugin_name, marketplace_name
			) v
			  ON v.plugin_name = p.plugin_name
			 AND v.marketplace_name = COALESCE(p.marketplace_name, '')
			${
				includeIgnored
					? sql``
					: sql`WHERE p.status <> 'ignored' AND COALESCE(m.status, '') <> 'ignored'`
			}
			ORDER BY s.install_count DESC NULLS LAST, p.plugin_name
		`);

		return (rows as unknown as Array<PluginWithStats & { versionStrings: string[] }>).map(
			(r) => {
				const { versionStrings, ...rest } = r;
				const versions = versionStrings ?? [];
				return {
					...rest,
					versionCount: versions.length,
					// Prefer semver-max over the catalog's last-written value.
					latestVersion: maxSemver(versions) ?? r.pluginVersion,
				};
			},
		);
	}

	async listSkillsWithActivations(pluginName: string): Promise<PluginSkillActivation[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  ps.skill_name               AS "skillName",
			  COUNT(e.id)::int            AS "activationCount"
			FROM plugin_skills ps
			LEFT JOIN events e
			  ON e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			 AND e.attributes->>'skill.name' = ps.skill_name
			 AND e.attributes->>'plugin.name' = ps.plugin_name
			WHERE ps.plugin_name = ${pluginName}
			GROUP BY ps.skill_name
			ORDER BY "activationCount" DESC, ps.skill_name ASC
		`);
		return rows as unknown as PluginSkillActivation[];
	}

	async listTopUsers(pluginName: string, limit: number): Promise<PluginUserActivation[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  e.user_email           AS "userEmail",
			  COUNT(e.id)::int       AS "activationCount"
			FROM events e
			JOIN plugin_skills ps
			  ON ps.skill_name = e.attributes->>'skill.name'
			 AND ps.plugin_name = e.attributes->>'plugin.name'
			WHERE e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  AND ps.plugin_name = ${pluginName}
			  AND e.user_email IS NOT NULL
			GROUP BY e.user_email
			ORDER BY "activationCount" DESC, e.user_email ASC
			LIMIT ${limit}
		`);
		return rows as unknown as PluginUserActivation[];
	}

	async findByName(pluginName: string): Promise<Plugin | null> {
		const rows = await this.db
			.select()
			.from(plugins)
			.where(eq(plugins.pluginName, pluginName))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		return {
			pluginName: row.pluginName,
			marketplaceName: row.marketplaceName,
			pluginVersion: row.pluginVersion,
			installTrigger: row.installTrigger,
			marketplaceIsOfficial: row.marketplaceIsOfficial,
			source: row.source,
			status: row.status as PluginStatus,
			firstSeenAt: row.firstSeenAt,
			lastSeenAt: row.lastSeenAt,
		};
	}

	async update(
		pluginName: string,
		updates: { status?: PluginStatus },
	): Promise<Plugin | null> {
		const set: { status?: PluginStatus } = {};
		if (updates.status !== undefined) set.status = updates.status;
		if (Object.keys(set).length === 0) return this.findByName(pluginName);
		const rows = await this.db
			.update(plugins)
			.set(set)
			.where(eq(plugins.pluginName, pluginName))
			.returning();
		const row = rows[0];
		if (!row) return null;
		return {
			pluginName: row.pluginName,
			marketplaceName: row.marketplaceName,
			pluginVersion: row.pluginVersion,
			installTrigger: row.installTrigger,
			marketplaceIsOfficial: row.marketplaceIsOfficial,
			source: row.source,
			status: row.status as PluginStatus,
			firstSeenAt: row.firstSeenAt,
			lastSeenAt: row.lastSeenAt,
		};
	}

	async upsert(plugin: NewPlugin): Promise<void> {
		const now = new Date();
		const sourceValue = plugin.source === undefined ? null : plugin.source;
		await this.db
			.insert(plugins)
			.values({
				pluginName: plugin.pluginName,
				marketplaceName: plugin.marketplaceName,
				pluginVersion: plugin.pluginVersion,
				installTrigger: plugin.installTrigger,
				marketplaceIsOfficial: plugin.marketplaceIsOfficial,
				source: sourceValue,
				status: plugin.status,
				firstSeenAt: now,
				lastSeenAt: now,
			})
			.onConflictDoUpdate({
				target: plugins.pluginName,
				set: {
					marketplaceName: plugin.marketplaceName,
					pluginVersion: plugin.pluginVersion,
					installTrigger: plugin.installTrigger,
					marketplaceIsOfficial: plugin.marketplaceIsOfficial,
					source: sourceValue,
					// status intentionally omitted: a re-ingested plugin_installed event
					// must not clobber a manual admin override (set via PATCH /plugins/:name).
					// Marketplace-wide status changes still cascade through syncPluginStatuses.
					lastSeenAt: now,
				},
			});
	}

	async upsertIfAbsent(plugin: NewPlugin): Promise<void> {
		const now = new Date();
		await this.db
			.insert(plugins)
			.values({
				pluginName: plugin.pluginName,
				marketplaceName: plugin.marketplaceName,
				pluginVersion: plugin.pluginVersion,
				installTrigger: plugin.installTrigger,
				marketplaceIsOfficial: plugin.marketplaceIsOfficial,
				source: plugin.source === undefined ? null : plugin.source,
				status: plugin.status,
				firstSeenAt: now,
				lastSeenAt: now,
			})
			.onConflictDoNothing({ target: plugins.pluginName });
	}

	async updateStatusByMarketplace(marketplaceName: string, status: PluginStatus): Promise<void> {
		await this.db
			.update(plugins)
			.set({ status })
			.where(eq(plugins.marketplaceName, marketplaceName));
	}

	async markRemovedByMarketplace(
		marketplaceName: string,
		activePluginNames: string[],
	): Promise<string[]> {
		const where =
			activePluginNames.length === 0
				? and(eq(plugins.marketplaceName, marketplaceName))
				: and(
						eq(plugins.marketplaceName, marketplaceName),
						notInArray(plugins.pluginName, activePluginNames),
					);
		const updated = await this.db
			.update(plugins)
			.set({ status: "removed" })
			.where(where)
			.returning({ pluginName: plugins.pluginName });
		return updated.map((row) => row.pluginName);
	}

	// Carve-out to the "upsert never clobbers status" rule (see upsert() above):
	// when a plugin sits at status='removed' but the latest marketplace sync sees it
	// listed again, flip it back to the marketplace-computed status. This only
	// touches `removed` rows (a sync-driven state per the upsert comment), so manual
	// admin overrides to other statuses (approved, to_review) are preserved.
	async reactivateRemovedByMarketplace(
		marketplaceName: string,
		presentPluginNames: string[],
		newStatus: PluginStatus,
	): Promise<string[]> {
		if (presentPluginNames.length === 0) return [];
		const updated = await this.db
			.update(plugins)
			.set({ status: newStatus })
			.where(
				and(
					eq(plugins.marketplaceName, marketplaceName),
					eq(plugins.status, "removed"),
					inArray(plugins.pluginName, presentPluginNames),
				),
			)
			.returning({ pluginName: plugins.pluginName });
		return updated.map((row) => row.pluginName);
	}

	async listNamesByMarketplace(marketplaceName: string): Promise<string[]> {
		const rows = await this.db
			.select({ pluginName: plugins.pluginName })
			.from(plugins)
			.where(eq(plugins.marketplaceName, marketplaceName));
		return rows.map((r) => r.pluginName);
	}

	async orphanByMarketplace(marketplaceName: string): Promise<string[]> {
		const updated = await this.db
			.update(plugins)
			.set({ marketplaceName: null, status: "removed" })
			.where(eq(plugins.marketplaceName, marketplaceName))
			.returning({ pluginName: plugins.pluginName });
		return updated.map((r) => r.pluginName);
	}

	async getLoadStats(window: TimeWindow): Promise<PluginLoadStats> {
		// uniqueLoadedPlugins counts distinct (plugin.name, marketplace.name) pairs
		// for non-redacted rows, plus distinct plugin_id_hash for redacted rows.
		// The two sets cannot overlap (a single load event is either redacted or
		// not), so a plain sum is correct.
		const [row] = (await this.db.execute(sql`
			WITH loads AS (
			  SELECT
			    attributes->>'plugin.name'        AS plugin_name,
			    NULLIF(attributes->>'marketplace.name', 'inline') AS marketplace_name,
			    attributes->>'plugin_id_hash'     AS plugin_id_hash,
			    user_email
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
			    ${timeFilter(window)}
			)
			SELECT
			  COUNT(*)::int AS total_loads,
			  COUNT(DISTINCT user_email)::int AS unique_loaders,
			  (
			    SELECT COUNT(*)::int FROM (
			      SELECT DISTINCT plugin_name, COALESCE(marketplace_name, '')
			      FROM loads
			      WHERE plugin_name IS NOT NULL AND plugin_name <> 'third-party'
			    ) named
			  ) + (
			    SELECT COUNT(DISTINCT plugin_id_hash)::int
			    FROM loads
			    WHERE plugin_name = 'third-party' AND plugin_id_hash IS NOT NULL
			  ) AS unique_loaded_plugins
			FROM loads
		`)) as unknown as Array<{
			total_loads: number | null;
			unique_loaders: number | null;
			unique_loaded_plugins: number | null;
		}>;
		return {
			totalLoads: row?.total_loads ?? 0,
			uniqueLoadedPlugins: row?.unique_loaded_plugins ?? 0,
			uniqueLoaders: row?.unique_loaders ?? 0,
		};
	}

	async getWeeklyLoadersByVersion(
		pluginName: string,
		marketplaceName: string | null,
	): Promise<PluginWeeklyLoaders> {
		// Marketplace matching mirrors listWithStats: events tagged with the
		// synthetic "inline" marketplace bucket are normalized to empty so they
		// join the null-marketplace plugin row.
		const marketplaceKey = marketplaceName ?? "";
		const rows = (await this.db.execute(sql`
			WITH spine AS (
			  SELECT generate_series(
			    date_trunc('week', NOW()) - INTERVAL '8 weeks',
			    date_trunc('week', NOW()),
			    INTERVAL '1 week'
			  )::date AS week_start
			),
			loads AS (
			  SELECT
			    date_trunc('week', timestamp)::date AS week_start,
			    attributes->>'plugin.version'       AS version,
			    user_email
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
			    AND attributes->>'plugin.name' = ${pluginName}
			    AND attributes->>'plugin.name' <> 'third-party'
			    AND COALESCE(NULLIF(attributes->>'marketplace.name', 'inline'), '') = ${marketplaceKey}
			    AND user_email IS NOT NULL
			    AND timestamp >= NOW() - INTERVAL '60 days'
			),
			per_version AS (
			  SELECT week_start, version, COUNT(DISTINCT user_email)::int AS loaders
			  FROM loads
			  WHERE version IS NOT NULL
			  GROUP BY 1, 2
			),
			totals AS (
			  SELECT week_start, COUNT(DISTINCT user_email)::int AS total
			  FROM loads
			  GROUP BY 1
			)
			SELECT
			  to_char(s.week_start, 'YYYY-MM-DD')   AS "weekStart",
			  COALESCE(t.total, 0)::int             AS "total",
			  pv.version                            AS "version",
			  pv.loaders                            AS "loaders"
			FROM spine s
			LEFT JOIN totals t       ON t.week_start = s.week_start
			LEFT JOIN per_version pv ON pv.week_start = s.week_start
			ORDER BY s.week_start ASC, pv.version ASC
		`)) as unknown as Array<{
			weekStart: string;
			total: number;
			version: string | null;
			loaders: number | null;
		}>;

		const bucketsByWeek = new Map<string, PluginWeeklyLoadersBucket>();
		const versionTotals = new Map<string, number>();
		for (const r of rows) {
			let bucket = bucketsByWeek.get(r.weekStart);
			if (!bucket) {
				bucket = { weekStart: r.weekStart, total: r.total, perVersion: {} };
				bucketsByWeek.set(r.weekStart, bucket);
			}
			if (r.version !== null && r.loaders !== null) {
				bucket.perVersion[r.version] = r.loaders;
				versionTotals.set(r.version, (versionTotals.get(r.version) ?? 0) + r.loaders);
			}
		}

		const weeks = Array.from(bucketsByWeek.values()).sort((a, b) =>
			a.weekStart.localeCompare(b.weekStart),
		);
		const versions = Array.from(versionTotals.entries())
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([v]) => v);

		return { weeks, versions };
	}

	async deleteByMarketplace(marketplaceName: string): Promise<string[]> {
		const deleted = await this.db
			.delete(plugins)
			.where(eq(plugins.marketplaceName, marketplaceName))
			.returning({ pluginName: plugins.pluginName });
		return deleted.map((r) => r.pluginName);
	}
}
