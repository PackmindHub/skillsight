import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { skills } from "@/db/schema";
import { EVENT_NAMES } from "@/domain/event";
import type {
	ISkillRepository,
	MonthlyTrends,
	SkillUpsertEntry,
	TimeWindow,
} from "@/domain/ports/skill-repository";
import type {
	Skill,
	SkillDetailPluginRef,
	SkillDetailRow,
	SkillKey,
	SkillStatus,
	SkillTableRow,
} from "@/domain/skill";
import type { GitProvider } from "@/domain/marketplace-source";
import { buildSkillRepoUrl } from "@/infrastructure/gateways/git-browse-url";
import { maxSemver } from "@/lib/semver";

const NO_PLUGIN = "";
const NO_MARKETPLACE = "";
const NO_SOURCE = "";
// Wire value of `skill.source` for plugin-owned skills — they are always
// attributed to their plugin, never to user/project settings.
const PLUGIN_SOURCE = "plugin";

interface NormalizedEntry {
	name: string;
	plugin: string;
	marketplace: string;
	source: string;
}

// AND-condition matching a full skill identity (all four PK columns).
function keyMatch(key: SkillKey) {
	return and(
		eq(skills.skillName, key.skillName),
		eq(skills.pluginName, key.pluginName),
		eq(skills.marketplaceName, key.marketplaceName),
		eq(skills.skillSource, key.skillSource),
	);
}

function dedupeEntries(entries: SkillUpsertEntry[]): NormalizedEntry[] {
	const seen = new Set<string>();
	const out: NormalizedEntry[] = [];
	for (const e of entries) {
		const name = e.skillName?.trim();
		if (!name) continue;
		const plugin = e.pluginName ?? NO_PLUGIN;
		// marketplace_name only discriminates plugin-owned rows; force '' for
		// plugin-less skills so the editable orphan identity stays
		// (name, '', '', source) and always joins to its status row.
		const marketplace =
			plugin === NO_PLUGIN ? NO_MARKETPLACE : (e.marketplaceName ?? NO_MARKETPLACE);
		const source = e.skillSource ?? NO_SOURCE;
		const key = [name, plugin, marketplace, source].join("\u0000");
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ name, plugin, marketplace, source });
	}
	return out;
}

function timeFilter(window: TimeWindow) {
	if (window.kind === "range") {
		// Bind as ISO strings: postgres-js's prepared-statement bind path doesn't
		// serialize raw Date objects here and throws in Buffer.byteLength.
		return sql`AND timestamp >= ${window.from.toISOString()}::timestamp AND timestamp < ${window.to.toISOString()}::timestamp`;
	}
	if (window.days === "all") return sql``;
	return sql`AND timestamp >= NOW() - (${window.days} || ' days')::interval`;
}

// Excludes events whose skill.name appears in the `skills` table with
// status='ignored' for any plugin pairing. Used to hide ignored skills from
// dashboards and aggregations by default. Cascades naturally because
// marketplace/plugin ignored statuses are propagated down to skill rows by
// syncPluginStatuses / updatePlugin / sync-marketplace-source.
const NOT_IGNORED_SKILL_NAME = sql`AND attributes->>'skill.name' NOT IN (
  SELECT skill_name FROM skills WHERE status = 'ignored'
)`;

const SPARKLINE_MAX_DAYS = 90;
const SPARKLINE_RANGE_MAX_DAYS = 365;

function sparklineParams(window: TimeWindow): { startDay: Date; length: number } {
	if (window.kind === "range") {
		const startDay = new Date(window.from);
		startDay.setUTCHours(0, 0, 0, 0);
		const endDay = new Date(window.to);
		endDay.setUTCHours(0, 0, 0, 0);
		const rawLen = Math.round((endDay.getTime() - startDay.getTime()) / 86_400_000);
		const length = Math.min(Math.max(1, rawLen), SPARKLINE_RANGE_MAX_DAYS);
		return { startDay, length };
	}
	const length =
		window.days === "all"
			? SPARKLINE_MAX_DAYS
			: Math.min(Math.max(1, window.days), SPARKLINE_MAX_DAYS);
	const startDay = new Date();
	startDay.setUTCHours(0, 0, 0, 0);
	startDay.setUTCDate(startDay.getUTCDate() - (length - 1));
	return { startDay, length };
}

function sparklineTimeFilter(window: TimeWindow) {
	if (window.kind === "range") {
		return sql`AND timestamp >= ${window.from.toISOString()}::timestamp AND timestamp < ${window.to.toISOString()}::timestamp`;
	}
	const { length } = sparklineParams(window);
	return sql`AND timestamp >= NOW() - (${length} || ' days')::interval`;
}

function buildDailySeries(
	dayCounts: Map<string, number>,
	startDay: Date,
	length: number,
): number[] {
	const out: number[] = [];
	const cursor = new Date(startDay);
	for (let i = 0; i < length; i++) {
		out.push(dayCounts.get(cursor.toISOString().slice(0, 10)) ?? 0);
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return out;
}

export class DrizzleSkillRepository implements ISkillRepository {
	constructor(private readonly db: AppDb) {}

	async getTopSkills(window: TimeWindow): Promise<Array<{ skillName: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'skill.name' AS skill_name, COUNT(*)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  AND attributes->>'skill.name' IS NOT NULL
			  ${NOT_IGNORED_SKILL_NAME}
			GROUP BY 1
			ORDER BY count DESC
			LIMIT 10
		`);
		return (rows as unknown as Array<{ skill_name: string; count: number }>).map((r) => ({
			skillName: r.skill_name,
			count: r.count,
		}));
	}

	async getDailyTrend(window: TimeWindow): Promise<Array<{ date: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  ${NOT_IGNORED_SKILL_NAME}
			GROUP BY 1
		`);
		const dayCounts = new Map<string, number>();
		for (const r of rows as unknown as Array<{ date: string; count: number }>) {
			dayCounts.set(r.date, r.count);
		}

		let cursor: Date;
		let endExclusive: Date;
		if (window.kind === "range") {
			cursor = new Date(window.from);
			cursor.setUTCHours(0, 0, 0, 0);
			endExclusive = new Date(window.to);
			endExclusive.setUTCHours(0, 0, 0, 0);
		} else {
			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);
			endExclusive = new Date(today);
			endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
			if (window.days === "all") {
				const earliest = [...dayCounts.keys()].sort()[0];
				if (!earliest) return [];
				const [y, m, d] = earliest.split("-").map(Number);
				cursor = new Date(Date.UTC(y, m - 1, d));
			} else {
				cursor = new Date(today);
				cursor.setUTCDate(cursor.getUTCDate() - (window.days - 1));
			}
		}

		const out: Array<{ date: string; count: number }> = [];
		while (cursor < endExclusive) {
			const iso = cursor.toISOString().slice(0, 10);
			out.push({ date: iso, count: dayCounts.get(iso) ?? 0 });
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}
		return out;
	}

	async getTopUsers(window: TimeWindow): Promise<Array<{ userEmail: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT user_email, COUNT(*)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  AND user_email IS NOT NULL
			  ${NOT_IGNORED_SKILL_NAME}
			GROUP BY user_email
			ORDER BY count DESC
			LIMIT 10
		`);
		return (rows as unknown as Array<{ user_email: string; count: number }>).map((r) => ({
			userEmail: r.user_email,
			count: r.count,
		}));
	}

	async getByTrigger(window: TimeWindow): Promise<Array<{ trigger: string | null; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'invocation_trigger' AS trigger, COUNT(*)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  ${NOT_IGNORED_SKILL_NAME}
			GROUP BY 1
			ORDER BY count DESC
		`);
		return rows as unknown as Array<{ trigger: string | null; count: number }>;
	}

	async getTotalActivations(window: TimeWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(*)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  ${NOT_IGNORED_SKILL_NAME}
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getUniqueSkillsCount(window: TimeWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT attributes->>'skill.name')::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  AND attributes->>'skill.name' IS NOT NULL
			  ${NOT_IGNORED_SKILL_NAME}
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getActiveUsersCount(window: TimeWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT user_email)::int AS count
			FROM events
			WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			  ${timeFilter(window)}
			  AND user_email IS NOT NULL
			  ${NOT_IGNORED_SKILL_NAME}
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getSkillsTable(window: TimeWindow, includeIgnored = false): Promise<SkillTableRow[]> {
		// One row per (skill_name, plugin_name) pair from plugin_skills,
		// plus orphan rows (plugin_name=NULL) for skills seen only in events.
		// skill_name carries a composite "pluginId:skillName" for plugin-owned
		// skills (see syncMarketplaceSource); the runtime emits the same composite
		// in attributes->>'skill.name'. Bundled/orphan skills stay bare.
		// `lastSeenAt` and `skillSource` are intentionally computed on the
		// *lifetime* event stream (no time filter) so they don't flicker when
		// the period shrinks — see SkillsTablePage's "Last used" column and the
		// "Never used" badge, both of which assume lifetime semantics.
		const { startDay, length } = sparklineParams(window);
		const [rows, dailyRows, lifetimeRows] = await Promise.all([
			this.db.execute(sql`
				WITH known_identities AS (
				  -- Plugin-owned skills: identity marketplace = plugin's catalog
				  -- marketplace, source is always 'plugin'.
				  SELECT
				    ps.skill_name,
				    ps.plugin_name,
				    COALESCE(p.marketplace_name, '') AS marketplace_name,
				    'plugin'::varchar AS skill_source
				  FROM plugin_skills ps
				  LEFT JOIN plugins p ON p.plugin_name = ps.plugin_name
				  UNION
				  -- Plugin-less skills seen in events: one identity per distinct
				  -- skill.source so the same skill from user vs project settings
				  -- (and bundled) are separate, independently-statusable rows.
				  SELECT DISTINCT
				    e.attributes->>'skill.name' AS skill_name,
				    NULL::varchar AS plugin_name,
				    ''::varchar AS marketplace_name,
				    COALESCE(e.attributes->>'skill.source', '') AS skill_source
				  FROM events e
				  WHERE e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				    AND e.attributes->>'skill.name' IS NOT NULL
				    AND NOT EXISTS (
				      SELECT 1 FROM plugin_skills ps
				      WHERE ps.skill_name = e.attributes->>'skill.name'
				    )
				),
				windowed_events AS (
				  SELECT
				    e.attributes->>'skill.name' AS skill_name,
				    COUNT(*)::int AS total,
				    COUNT(DISTINCT e.user_email)::int AS unique_users,
				    COUNT(DISTINCT e.session_id)::int AS unique_sessions,
				    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
				    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
				    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill,
				    array_agg(DISTINCT e.attributes->>'marketplace.name') FILTER (
				      WHERE e.attributes->>'marketplace.name' IS NOT NULL
				        AND e.attributes->>'marketplace.name' <> 'inline'
				    ) AS event_marketplace_names
				  FROM events e
				  WHERE e.event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				    ${timeFilter(window)}
				    AND e.attributes->>'skill.name' IS NOT NULL
				  GROUP BY 1
				),
				pair_marketplace AS (
				  SELECT ps.skill_name, ps.plugin_name, p.marketplace_name
				  FROM plugin_skills ps
				  JOIN plugins p ON p.plugin_name = ps.plugin_name
				),
				plugin_loaders AS (
				  SELECT
				    attributes->>'plugin.name'      AS plugin_name,
				    COUNT(DISTINCT user_email)::int AS unique_loaders
				  FROM events
				  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
				    AND attributes->>'plugin.name' IS NOT NULL
				    AND attributes->>'plugin.name' <> 'third-party'
				    AND user_email IS NOT NULL
				  GROUP BY 1
				)
				SELECT
				  ki.skill_name,
				  ki.plugin_name,
				  ki.marketplace_name AS identity_marketplace,
				  ki.skill_source,
				  COALESCE(we.total, 0)::int AS total,
				  COALESCE(we.unique_users, 0)::int AS unique_users,
				  COALESCE(we.unique_sessions, 0)::int AS unique_sessions,
				  COALESCE(we.user_slash, 0)::int AS user_slash,
				  COALESCE(we.claude_proactive, 0)::int AS claude_proactive,
				  COALESCE(we.nested_skill, 0)::int AS nested_skill,
				  ARRAY(
				    SELECT DISTINCT x
				    FROM unnest(
				      COALESCE(we.event_marketplace_names, ARRAY[]::text[]) ||
				      CASE WHEN pm.marketplace_name IS NOT NULL THEN ARRAY[pm.marketplace_name] ELSE ARRAY[]::text[] END
				    ) AS x
				    WHERE x IS NOT NULL
				    ORDER BY x
				  ) AS marketplace_names,
				  COALESCE(s.status, 'to_review') AS status,
				  pl.unique_loaders AS plugin_unique_loaders
				FROM known_identities ki
				LEFT JOIN windowed_events we ON we.skill_name = ki.skill_name
				LEFT JOIN pair_marketplace pm
				  ON pm.skill_name = ki.skill_name
				 AND pm.plugin_name = ki.plugin_name
				LEFT JOIN skills s
				  ON s.skill_name = ki.skill_name
				 AND s.plugin_name = COALESCE(ki.plugin_name, '')
				 AND s.marketplace_name = ki.marketplace_name
				 AND s.skill_source = ki.skill_source
				LEFT JOIN plugin_loaders pl ON pl.plugin_name = ki.plugin_name
				${
					includeIgnored
						? sql``
						: sql`WHERE COALESCE(s.status, 'to_review') <> 'ignored'
				          AND NOT EXISTS (
				            SELECT 1 FROM skills _si
				            WHERE _si.skill_name = ki.skill_name AND _si.status = 'ignored'
				          )`
				}
				ORDER BY total DESC, ki.skill_name ASC, ki.plugin_name ASC NULLS LAST, ki.skill_source ASC
			`),
			this.db.execute(sql`
				SELECT
				  attributes->>'skill.name' AS skill_name,
				  to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS day,
				  COUNT(*)::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  ${sparklineTimeFilter(window)}
				  AND attributes->>'skill.name' IS NOT NULL
				GROUP BY 1, 2
			`),
			this.db.execute(sql`
				SELECT
				  attributes->>'skill.name' AS skill_name,
				  MAX(timestamp) AS last_seen_at,
				  MODE() WITHIN GROUP (ORDER BY attributes->>'skill.source')
				    FILTER (WHERE attributes->>'skill.source' IS NOT NULL) AS skill_source
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  AND attributes->>'skill.name' IS NOT NULL
				GROUP BY 1
			`),
		]);

		const lifetimeMap = new Map<string, { lastSeenAt: string | null; skillSource: string | null }>();
		for (const r of lifetimeRows as unknown as Array<{
			skill_name: string;
			last_seen_at: Date | string | null;
			skill_source: string | null;
		}>) {
			lifetimeMap.set(r.skill_name, {
				lastSeenAt:
					r.last_seen_at == null
						? null
						: r.last_seen_at instanceof Date
							? r.last_seen_at.toISOString()
							: new Date(r.last_seen_at).toISOString(),
				skillSource: r.skill_source ?? null,
			});
		}

		const dailyMap = new Map<string, Map<string, number>>();
		for (const r of dailyRows as unknown as Array<{
			skill_name: string;
			day: string;
			count: number;
		}>) {
			let m = dailyMap.get(r.skill_name);
			if (!m) {
				m = new Map();
				dailyMap.set(r.skill_name, m);
			}
			m.set(r.day, r.count);
		}

		return (
			rows as unknown as Array<{
				skill_name: string;
				plugin_name: string | null;
				identity_marketplace: string;
				skill_source: string | null;
				total: number;
				unique_users: number;
				unique_sessions: number;
				user_slash: number;
				claude_proactive: number;
				nested_skill: number;
				marketplace_names: string[];
				status: SkillStatus;
				plugin_unique_loaders: number | null;
			}>
		).map((r) => {
			const lifetime = lifetimeMap.get(r.skill_name);
			return {
				skillName: r.skill_name,
				pluginName: r.plugin_name,
				// Identity marketplace ('' for orphans) — the status-key component,
				// distinct from the cosmetic `marketplaceNames` set below.
				marketplaceName: r.identity_marketplace,
				// Source now comes from the row's identity, not a lifetime MODE.
				skillSource: r.skill_source ?? null,
				total: r.total,
				uniqueUsers: r.unique_users,
				uniqueSessions: r.unique_sessions,
				userSlash: r.user_slash,
				claudeProactive: r.claude_proactive,
				nestedSkill: r.nested_skill,
				marketplaceNames: r.marketplace_names ?? [],
				status: (r.status ?? "to_review") as SkillStatus,
				lastSeenAt: lifetime?.lastSeenAt ?? null,
				dailyCounts: buildDailySeries(dailyMap.get(r.skill_name) ?? new Map(), startDay, length),
				pluginUniqueLoaders: r.plugin_name == null ? null : r.plugin_unique_loaders ?? 0,
			};
		});
	}

	async getSkillDetail(skillName: string, window: TimeWindow): Promise<SkillDetailRow | null> {
		const { startDay, length } = sparklineParams(window);

		const [aggRows, dailyRows, topUserRows, seenRows, marketplaceRows, pluginRows] = await Promise.all([
			this.db.execute(sql`
				SELECT
				  COUNT(*)::int AS total,
				  COUNT(DISTINCT user_email)::int AS unique_users,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  ${timeFilter(window)}
				  AND attributes->>'skill.name' = ${skillName}
			`),
			this.db.execute(sql`
				SELECT
				  to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS day,
				  COUNT(*)::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  ${sparklineTimeFilter(window)}
				  AND attributes->>'skill.name' = ${skillName}
				GROUP BY 1
			`),
			this.db.execute(sql`
				SELECT user_email, COUNT(*)::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  ${timeFilter(window)}
				  AND attributes->>'skill.name' = ${skillName}
				  AND user_email IS NOT NULL
				GROUP BY user_email
				ORDER BY count DESC
				LIMIT 10
			`),
			// Lifetime first/last seen + modal skill source — intentionally not
			// windowed so the detail drawer's "Last seen" and Source agree with
			// the table and don't flicker when the user shrinks the period.
			this.db.execute(sql`
				SELECT
				  MIN(timestamp) AS first_seen_at,
				  MAX(timestamp) AS last_seen_at,
				  MODE() WITHIN GROUP (ORDER BY attributes->>'skill.source')
				    FILTER (WHERE attributes->>'skill.source' IS NOT NULL) AS skill_source
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  AND attributes->>'skill.name' = ${skillName}
			`),
			this.db.execute(sql`
				WITH event_mps AS (
				  SELECT DISTINCT attributes->>'marketplace.name' AS name
				  FROM events
				  WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				    ${timeFilter(window)}
				    AND attributes->>'skill.name' = ${skillName}
				    AND attributes->>'marketplace.name' IS NOT NULL
				    AND attributes->>'marketplace.name' <> 'inline'
				),
				plugin_mps AS (
				  SELECT DISTINCT p.marketplace_name AS name
				  FROM plugin_skills ps
				  JOIN plugins p ON p.plugin_name = ps.plugin_name
				  WHERE ps.skill_name = ${skillName}
				    AND p.marketplace_name IS NOT NULL
				)
				SELECT
				  ARRAY(
				    SELECT DISTINCT name FROM (
				      SELECT name FROM event_mps
				      UNION ALL
				      SELECT name FROM plugin_mps
				    ) x
				    WHERE name IS NOT NULL
				    ORDER BY name
				  ) AS marketplace_names,
				  (
				    SELECT
				      CASE
				        WHEN BOOL_OR(status = 'removed') THEN 'removed'
				        WHEN BOOL_OR(status = 'to_review') THEN 'to_review'
				        WHEN BOOL_OR(status = 'approved') THEN 'approved'
				        ELSE 'to_review'
				      END
				    FROM skills WHERE skill_name = ${skillName}
				  ) AS status
			`),
			this.db.execute(sql`
				SELECT
				  ps.plugin_name        AS plugin_name,
				  p.marketplace_name    AS marketplace_name,
				  COALESCE(p.status, 'to_review') AS status,
				  p.source              AS plugin_source,
				  p.plugin_version      AS catalog_version,
				  ms.git_url            AS git_url,
				  ms.branch             AS branch,
				  ms.provider           AS provider,
				  COALESCE(l.load_count, 0)::int     AS load_count,
				  COALESCE(l.unique_loaders, 0)::int AS unique_loader_count,
				  COALESCE(v.versions, ARRAY[]::text[]) AS version_strings
				FROM plugin_skills ps
				LEFT JOIN plugins p ON p.plugin_name = ps.plugin_name
				LEFT JOIN LATERAL (
				  SELECT git_url, branch, provider
				  FROM marketplace_sources
				  WHERE marketplace_name = p.marketplace_name
				  ORDER BY created_at ASC
				  LIMIT 1
				) ms ON TRUE
				LEFT JOIN LATERAL (
				  SELECT
				    COUNT(*)::int                    AS load_count,
				    COUNT(DISTINCT user_email)::int  AS unique_loaders
				  FROM events
				  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
				    AND attributes->>'plugin.name' = ps.plugin_name
				    AND attributes->>'plugin.name' <> 'third-party'
				    AND COALESCE(NULLIF(attributes->>'marketplace.name', 'inline'), '') = COALESCE(p.marketplace_name, '')
				) l ON TRUE
				LEFT JOIN LATERAL (
				  SELECT array_agg(version ORDER BY last_seen_at DESC) AS versions
				  FROM plugin_versions
				  WHERE plugin_name = ps.plugin_name
				    AND marketplace_name = COALESCE(p.marketplace_name, '')
				) v ON TRUE
				WHERE ps.skill_name = ${skillName}
				ORDER BY ps.plugin_name
			`),
		]);

		const known = await this.db.execute(sql`
			SELECT 1 AS exists
			FROM (
			  SELECT DISTINCT attributes->>'skill.name' AS skill_name
			  FROM events
			  WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
			    AND attributes->>'skill.name' = ${skillName}
			  UNION
			  SELECT DISTINCT skill_name FROM plugin_skills WHERE skill_name = ${skillName}
			) k
			LIMIT 1
		`);
		if ((known as unknown as Array<{ exists: number }>).length === 0) return null;

		const agg = (aggRows as unknown as Array<{
			total: number;
			unique_users: number;
			user_slash: number;
			claude_proactive: number;
			nested_skill: number;
		}>)[0];

		const dayCountMap = new Map<string, number>();
		for (const r of dailyRows as unknown as Array<{ day: string; count: number }>) {
			dayCountMap.set(r.day, r.count);
		}

		const dailyCounts: { date: string; count: number }[] = [];
		const cursor = new Date(startDay);
		for (let i = 0; i < length; i++) {
			const key = cursor.toISOString().slice(0, 10);
			dailyCounts.push({ date: key, count: dayCountMap.get(key) ?? 0 });
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}

		const topUsers = (topUserRows as unknown as Array<{ user_email: string; count: number }>).map(
			(r) => ({ userEmail: r.user_email, count: r.count }),
		);

		const seen = (seenRows as unknown as Array<{
			first_seen_at: Date | string | null;
			last_seen_at: Date | string | null;
			skill_source: string | null;
		}>)[0];
		const toIso = (v: Date | string | null) =>
			v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();

		const mp = (marketplaceRows as unknown as Array<{
			marketplace_names: string[] | null;
			status: SkillStatus | null;
		}>)[0];

		const colonIdx = skillName.indexOf(":");
		const skillSuffix = colonIdx >= 0 ? skillName.slice(colonIdx + 1) : "";

		const plugins: SkillDetailPluginRef[] = (pluginRows as unknown as Array<{
			plugin_name: string;
			marketplace_name: string | null;
			status: string | null;
			plugin_source: string | null;
			catalog_version: string | null;
			git_url: string | null;
			branch: string | null;
			provider: string | null;
			load_count: number;
			unique_loader_count: number;
			version_strings: string[] | null;
		}>).map((r) => {
			const versions = r.version_strings ?? [];
			return {
				pluginName: r.plugin_name,
				marketplaceName: r.marketplace_name ?? null,
				status: r.status ?? "to_review",
				skillRepoUrl:
					r.git_url && r.plugin_source && skillSuffix
						? buildSkillRepoUrl(
								r.git_url,
								r.branch,
								r.plugin_source,
								skillSuffix,
								(r.provider as GitProvider | null) ?? "auto",
							)
						: null,
				loadCount: r.load_count ?? 0,
				uniqueLoaderCount: r.unique_loader_count ?? 0,
				// Prefer semver-max from version history; fall back to the catalog
				// row's last-written `plugin_version` if no version rows exist yet.
				latestVersion: maxSemver(versions) ?? r.catalog_version,
			};
		});

		return {
			skillName,
			skillSource: seen?.skill_source ?? null,
			total: agg?.total ?? 0,
			uniqueUsers: agg?.unique_users ?? 0,
			userSlash: agg?.user_slash ?? 0,
			claudeProactive: agg?.claude_proactive ?? 0,
			nestedSkill: agg?.nested_skill ?? 0,
			dailyCounts,
			topUsers,
			firstSeenAt: toIso(seen?.first_seen_at ?? null),
			lastSeenAt: toIso(seen?.last_seen_at ?? null),
			marketplaceNames: mp?.marketplace_names ?? [],
			plugins,
			status: (mp?.status ?? "to_review") as SkillStatus,
		};
	}

	async getMonthlyTrends(): Promise<MonthlyTrends> {
		const [invocationsRows, uniqueSkillsRows, uniqueUsersRows] = await Promise.all([
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month, COUNT(*)::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  ${NOT_IGNORED_SKILL_NAME}
				GROUP BY DATE_TRUNC('month', timestamp)
				ORDER BY 1
			`),
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month,
				       COUNT(DISTINCT attributes->>'skill.name')::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  AND attributes->>'skill.name' IS NOT NULL
				  ${NOT_IGNORED_SKILL_NAME}
				GROUP BY DATE_TRUNC('month', timestamp)
				ORDER BY 1
			`),
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month,
				       COUNT(DISTINCT user_email)::int AS count
				FROM events
				WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
				  AND user_email IS NOT NULL
				  ${NOT_IGNORED_SKILL_NAME}
				GROUP BY DATE_TRUNC('month', timestamp)
				ORDER BY 1
			`),
		]);

		return {
			invocations: invocationsRows as unknown as Array<{ month: string; count: number }>,
			uniqueSkills: uniqueSkillsRows as unknown as Array<{ month: string; count: number }>,
			uniqueUsers: uniqueUsersRows as unknown as Array<{ month: string; count: number }>,
		};
	}

	async upsertMany(entries: SkillUpsertEntry[]): Promise<void> {
		const unique = dedupeEntries(entries);
		if (unique.length === 0) return;
		const now = new Date();
		await this.db
			.insert(skills)
			.values(
				unique.map((e) => ({
					skillName: e.name,
					pluginName: e.plugin,
					marketplaceName: e.marketplace,
					skillSource: e.source,
					status: "to_review",
					lastSeenAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: [skills.skillName, skills.pluginName, skills.marketplaceName, skills.skillSource],
				set: { lastSeenAt: now },
			});
	}

	async propagateStatusFromPlugins(
		affectedPluginNames: string[],
		newStatus: SkillStatus,
	): Promise<void> {
		if (affectedPluginNames.length === 0) return;
		await this.db
			.update(skills)
			.set({ status: newStatus, lastSeenAt: new Date() })
			.where(inArray(skills.pluginName, affectedPluginNames));
	}

	async deleteByPlugins(pluginNames: string[]): Promise<void> {
		if (pluginNames.length === 0) return;
		await this.db.delete(skills).where(inArray(skills.pluginName, pluginNames));
	}

	async deleteByKeys(entries: SkillKey[]): Promise<number> {
		if (entries.length === 0) return 0;
		const conditions = entries.map((e) => keyMatch(e));
		const deleted = await this.db
			.delete(skills)
			.where(or(...conditions))
			.returning({ skillName: skills.skillName });
		return deleted.length;
	}

	async findByKey(key: SkillKey): Promise<Skill | null> {
		const rows = await this.db
			.select({
				skillName: skills.skillName,
				pluginName: skills.pluginName,
				marketplaceName: skills.marketplaceName,
				skillSource: skills.skillSource,
				status: skills.status,
				firstSeenAt: skills.firstSeenAt,
				lastSeenAt: skills.lastSeenAt,
			})
			.from(skills)
			.where(keyMatch(key))
			.limit(1);
		const row = rows[0];
		if (!row) return null;
		return { ...row, status: row.status as SkillStatus };
	}

	async updateStatus(key: SkillKey, status: SkillStatus): Promise<Skill | null> {
		const rows = await this.db
			.update(skills)
			.set({ status, lastSeenAt: new Date() })
			.where(keyMatch(key))
			.returning({
				skillName: skills.skillName,
				pluginName: skills.pluginName,
				marketplaceName: skills.marketplaceName,
				skillSource: skills.skillSource,
				status: skills.status,
				firstSeenAt: skills.firstSeenAt,
				lastSeenAt: skills.lastSeenAt,
			});
		const row = rows[0];
		if (!row) return null;
		return { ...row, status: row.status as SkillStatus };
	}

	async relinkOrphans(
		entries: Array<{ skillName: string; pluginName: string; marketplaceName: string }>,
	): Promise<number> {
		if (entries.length === 0) return 0;
		let migrated = 0;
		for (const e of entries) {
			// The legacy bare orphan created by ingest before a plugin mapping existed.
			const bareOrphan = and(
				eq(skills.skillName, e.skillName),
				eq(skills.pluginName, NO_PLUGIN),
				eq(skills.marketplaceName, NO_MARKETPLACE),
				eq(skills.skillSource, NO_SOURCE),
			);
			const [orphan] = await this.db.select().from(skills).where(bareOrphan).limit(1);
			if (!orphan) continue;
			const target: SkillKey = {
				skillName: e.skillName,
				pluginName: e.pluginName,
				marketplaceName: e.marketplaceName,
				skillSource: PLUGIN_SOURCE,
			};
			const [existingLinked] = await this.db
				.select({ skillName: skills.skillName })
				.from(skills)
				.where(keyMatch(target))
				.limit(1);
			if (existingLinked) {
				// Linked row already exists. Drop the orphan; the linked row wins.
				await this.db.delete(skills).where(bareOrphan);
				migrated++;
				continue;
			}
			await this.db.insert(skills).values({
				skillName: e.skillName,
				pluginName: e.pluginName,
				marketplaceName: e.marketplaceName,
				skillSource: PLUGIN_SOURCE,
				status: orphan.status,
				firstSeenAt: orphan.firstSeenAt,
				lastSeenAt: orphan.lastSeenAt,
			});
			await this.db.delete(skills).where(bareOrphan);
			migrated++;
		}
		return migrated;
	}
}
