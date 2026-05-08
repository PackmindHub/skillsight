import { sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import type {
	DaysWindow,
	ISkillRepository,
	MonthlyTrends,
} from "@/domain/ports/skill-repository";
import type { SkillDetailRow, SkillTableRow } from "@/domain/skill";

function timeFilter(days: DaysWindow) {
	return days === "all"
		? sql``
		: sql`AND timestamp >= NOW() - (${days} || ' days')::interval`;
}

const SPARKLINE_MAX_DAYS = 90;

function sparklineLength(days: DaysWindow): number {
	if (days === "all") return SPARKLINE_MAX_DAYS;
	return Math.min(Math.max(1, days), SPARKLINE_MAX_DAYS);
}

function buildDailySeries(
	dayCounts: Map<string, number>,
	length: number,
): number[] {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const out: number[] = [];
	for (let i = length - 1; i >= 0; i--) {
		const d = new Date(today);
		d.setUTCDate(d.getUTCDate() - i);
		out.push(dayCounts.get(d.toISOString().slice(0, 10)) ?? 0);
	}
	return out;
}

export class DrizzleSkillRepository implements ISkillRepository {
	constructor(private readonly db: AppDb) {}

	async getTopSkills(days: DaysWindow): Promise<Array<{ skillName: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'skill.name' AS skill_name, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			  AND attributes->>'skill.name' IS NOT NULL
			GROUP BY 1
			ORDER BY count DESC
			LIMIT 10
		`);
		return (rows as unknown as Array<{ skill_name: string; count: number }>).map((r) => ({
			skillName: r.skill_name,
			count: r.count,
		}));
	}

	async getDailyTrend(days: DaysWindow): Promise<Array<{ date: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT DATE_TRUNC('day', timestamp)::date AS date, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			GROUP BY 1
			ORDER BY 1
		`);
		return rows as unknown as Array<{ date: string; count: number }>;
	}

	async getTopUsers(days: DaysWindow): Promise<Array<{ userEmail: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT user_email, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			  AND user_email IS NOT NULL
			GROUP BY user_email
			ORDER BY count DESC
			LIMIT 10
		`);
		return (rows as unknown as Array<{ user_email: string; count: number }>).map((r) => ({
			userEmail: r.user_email,
			count: r.count,
		}));
	}

	async getByTrigger(days: DaysWindow): Promise<Array<{ trigger: string | null; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'invocation_trigger' AS trigger, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			GROUP BY 1
			ORDER BY count DESC
		`);
		return rows as unknown as Array<{ trigger: string | null; count: number }>;
	}

	async getTotalActivations(days: DaysWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getUniqueSkillsCount(days: DaysWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT attributes->>'skill.name')::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			  AND attributes->>'skill.name' IS NOT NULL
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getActiveUsersCount(days: DaysWindow): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT user_email)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  ${timeFilter(days)}
			  AND user_email IS NOT NULL
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getSkillsTable(days: DaysWindow): Promise<SkillTableRow[]> {
		const rows = await this.db.execute(sql`
			WITH known_skills AS (
			  SELECT DISTINCT attributes->>'skill.name' AS skill_name
			  FROM events
			  WHERE event_name = 'claude_code.skill_activated'
			    AND attributes->>'skill.name' IS NOT NULL
			  UNION
			  SELECT DISTINCT skill_name FROM plugin_skills
			),
			windowed_events AS (
			  SELECT
			    e.attributes->>'skill.name' AS skill_name,
			    MIN(e.attributes->>'skill.source') AS skill_source,
			    COUNT(*)::int AS total,
			    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
			    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
			    COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill,
			    array_remove(array_agg(DISTINCT e.attributes->>'marketplace.name'), NULL) AS event_marketplace_names
			  FROM events e
			  WHERE e.event_name = 'claude_code.skill_activated'
			    ${days === "all" ? sql`` : sql`AND e.timestamp >= NOW() - (${days} || ' days')::interval`}
			    AND e.attributes->>'skill.name' IS NOT NULL
			  GROUP BY 1
			),
			plugin_marketplaces AS (
			  SELECT
			    ps.skill_name,
			    array_remove(array_agg(DISTINCT p.marketplace_name), NULL) AS plugin_marketplace_names
			  FROM plugin_skills ps
			  JOIN plugins p ON p.plugin_name = ps.plugin_name
			  GROUP BY ps.skill_name
			),
			skill_plugin_status AS (
			  SELECT
			    ps.skill_name,
			    BOOL_AND(p.status = 'removed') AS all_removed
			  FROM plugin_skills ps
			  JOIN plugins p ON p.plugin_name = ps.plugin_name
			  GROUP BY ps.skill_name
			)
			SELECT
			  ks.skill_name,
			  we.skill_source AS skill_source,
			  COALESCE(we.total, 0)::int AS total,
			  COALESCE(we.user_slash, 0)::int AS user_slash,
			  COALESCE(we.claude_proactive, 0)::int AS claude_proactive,
			  COALESCE(we.nested_skill, 0)::int AS nested_skill,
			  ARRAY(
			    SELECT DISTINCT x
			    FROM unnest(
			      COALESCE(we.event_marketplace_names, ARRAY[]::text[]) ||
			      COALESCE(pm.plugin_marketplace_names, ARRAY[]::text[])
			    ) AS x
			    WHERE x IS NOT NULL
			    ORDER BY x
			  ) AS marketplace_names,
			  CASE WHEN sps.all_removed IS TRUE THEN 'removed' ELSE NULL END AS status
			FROM known_skills ks
			LEFT JOIN windowed_events we ON we.skill_name = ks.skill_name
			LEFT JOIN plugin_marketplaces pm ON pm.skill_name = ks.skill_name
			LEFT JOIN skill_plugin_status sps ON sps.skill_name = ks.skill_name
			ORDER BY total DESC, ks.skill_name ASC
		`);
		const tableRows = (
			rows as unknown as Array<{
				skill_name: string;
				skill_source: string | null;
				total: number;
				user_slash: number;
				claude_proactive: number;
				nested_skill: number;
				marketplace_names: string[];
				status: "removed" | null;
			}>
		).map((r) => ({
			skillName: r.skill_name,
			skillSource: r.skill_source ?? null,
			total: r.total,
			userSlash: r.user_slash,
			claudeProactive: r.claude_proactive,
			nestedSkill: r.nested_skill,
			marketplaceNames: r.marketplace_names ?? [],
			status: r.status ?? null,
		}));

		const length = sparklineLength(days);
		const dailyRows = await this.db.execute(sql`
			SELECT
			  attributes->>'skill.name' AS skill_name,
			  to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS day,
			  COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${length} || ' days')::interval
			  AND attributes->>'skill.name' IS NOT NULL
			GROUP BY 1, 2
		`);

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

		return tableRows.map((row) => ({
			...row,
			dailyCounts: buildDailySeries(dailyMap.get(row.skillName) ?? new Map(), length),
		}));
	}

	async getSkillDetail(skillName: string, days: DaysWindow): Promise<SkillDetailRow | null> {
		const length = sparklineLength(days);

		const [aggRows, dailyRows, topUserRows, seenRows, marketplaceRows] = await Promise.all([
			this.db.execute(sql`
				SELECT
				  MIN(attributes->>'skill.source') AS skill_source,
				  COUNT(*)::int AS total,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
				  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				  ${timeFilter(days)}
				  AND attributes->>'skill.name' = ${skillName}
			`),
			this.db.execute(sql`
				SELECT
				  to_char(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS day,
				  COUNT(*)::int AS count
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				  AND timestamp >= NOW() - (${length} || ' days')::interval
				  AND attributes->>'skill.name' = ${skillName}
				GROUP BY 1
			`),
			this.db.execute(sql`
				SELECT user_email, COUNT(*)::int AS count
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				  ${timeFilter(days)}
				  AND attributes->>'skill.name' = ${skillName}
				  AND user_email IS NOT NULL
				GROUP BY user_email
				ORDER BY count DESC
				LIMIT 10
			`),
			this.db.execute(sql`
				SELECT
				  MIN(first_seen_at) AS first_seen_at,
				  MAX(last_seen_at) AS last_seen_at
				FROM plugin_skills
				WHERE skill_name = ${skillName}
			`),
			this.db.execute(sql`
				WITH event_mps AS (
				  SELECT DISTINCT attributes->>'marketplace.name' AS name
				  FROM events
				  WHERE event_name = 'claude_code.skill_activated'
				    ${timeFilter(days)}
				    AND attributes->>'skill.name' = ${skillName}
				    AND attributes->>'marketplace.name' IS NOT NULL
				),
				plugin_mps AS (
				  SELECT DISTINCT p.marketplace_name AS name
				  FROM plugin_skills ps
				  JOIN plugins p ON p.plugin_name = ps.plugin_name
				  WHERE ps.skill_name = ${skillName}
				    AND p.marketplace_name IS NOT NULL
				),
				all_removed AS (
				  SELECT BOOL_AND(p.status = 'removed') AS all_removed
				  FROM plugin_skills ps
				  JOIN plugins p ON p.plugin_name = ps.plugin_name
				  WHERE ps.skill_name = ${skillName}
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
				  (SELECT all_removed FROM all_removed) AS all_removed
			`),
		]);

		const known = await this.db.execute(sql`
			SELECT 1 AS exists
			FROM (
			  SELECT DISTINCT attributes->>'skill.name' AS skill_name
			  FROM events
			  WHERE event_name = 'claude_code.skill_activated'
			    AND attributes->>'skill.name' = ${skillName}
			  UNION
			  SELECT DISTINCT skill_name FROM plugin_skills WHERE skill_name = ${skillName}
			) k
			LIMIT 1
		`);
		if ((known as unknown as Array<{ exists: number }>).length === 0) return null;

		const agg = (aggRows as unknown as Array<{
			skill_source: string | null;
			total: number;
			user_slash: number;
			claude_proactive: number;
			nested_skill: number;
		}>)[0];

		const dayCountMap = new Map<string, number>();
		for (const r of dailyRows as unknown as Array<{ day: string; count: number }>) {
			dayCountMap.set(r.day, r.count);
		}

		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		const dailyCounts: { date: string; count: number }[] = [];
		for (let i = length - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setUTCDate(d.getUTCDate() - i);
			const key = d.toISOString().slice(0, 10);
			dailyCounts.push({ date: key, count: dayCountMap.get(key) ?? 0 });
		}

		const topUsers = (topUserRows as unknown as Array<{ user_email: string; count: number }>).map(
			(r) => ({ userEmail: r.user_email, count: r.count }),
		);

		const seen = (seenRows as unknown as Array<{
			first_seen_at: Date | string | null;
			last_seen_at: Date | string | null;
		}>)[0];
		const toIso = (v: Date | string | null) =>
			v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();

		const mp = (marketplaceRows as unknown as Array<{
			marketplace_names: string[] | null;
			all_removed: boolean | null;
		}>)[0];

		return {
			skillName,
			skillSource: agg?.skill_source ?? null,
			total: agg?.total ?? 0,
			userSlash: agg?.user_slash ?? 0,
			claudeProactive: agg?.claude_proactive ?? 0,
			nestedSkill: agg?.nested_skill ?? 0,
			dailyCounts,
			topUsers,
			firstSeenAt: toIso(seen?.first_seen_at ?? null),
			lastSeenAt: toIso(seen?.last_seen_at ?? null),
			marketplaceNames: mp?.marketplace_names ?? [],
			status: mp?.all_removed === true ? "removed" : null,
		};
	}

	async getMonthlyTrends(): Promise<MonthlyTrends> {
		const [invocationsRows, uniqueSkillsRows, uniqueUsersRows] = await Promise.all([
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month, COUNT(*)::int AS count
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				GROUP BY DATE_TRUNC('month', timestamp)
				ORDER BY 1
			`),
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month,
				       COUNT(DISTINCT attributes->>'skill.name')::int AS count
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				  AND attributes->>'skill.name' IS NOT NULL
				GROUP BY DATE_TRUNC('month', timestamp)
				ORDER BY 1
			`),
			this.db.execute(sql`
				SELECT to_char(DATE_TRUNC('month', timestamp), 'YYYY-MM-DD') AS month,
				       COUNT(DISTINCT user_email)::int AS count
				FROM events
				WHERE event_name = 'claude_code.skill_activated'
				  AND user_email IS NOT NULL
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
}
