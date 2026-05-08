import { sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import type {
	DaysWindow,
	ISkillRepository,
	MonthlyTrends,
} from "@/domain/ports/skill-repository";
import type { SkillTableRow } from "@/domain/skill";

function timeFilter(days: DaysWindow) {
	return days === "all"
		? sql``
		: sql`AND timestamp >= NOW() - (${days} || ' days')::interval`;
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
		return (
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
