import { sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { SkillTableRow } from "@/domain/skill";

export class DrizzleSkillRepository implements ISkillRepository {
	constructor(private readonly db: AppDb) {}

	async getTopSkills(days: number): Promise<Array<{ skillName: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'skill.name' AS skill_name, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
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

	async getDailyTrend(days: number): Promise<Array<{ date: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT DATE_TRUNC('day', timestamp)::date AS date, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
			GROUP BY 1
			ORDER BY 1
		`);
		return rows as unknown as Array<{ date: string; count: number }>;
	}

	async getTopUsers(days: number): Promise<Array<{ userEmail: string; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT user_email, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
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

	async getByTrigger(days: number): Promise<Array<{ trigger: string | null; count: number }>> {
		const rows = await this.db.execute(sql`
			SELECT attributes->>'invocation_trigger' AS trigger, COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
			GROUP BY 1
			ORDER BY count DESC
		`);
		return rows as unknown as Array<{ trigger: string | null; count: number }>;
	}

	async getTotalActivations(days: number): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(*)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getUniqueSkillsCount(days: number): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT attributes->>'skill.name')::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
			  AND attributes->>'skill.name' IS NOT NULL
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getActiveUsersCount(days: number): Promise<number> {
		const [row] = await this.db.execute(sql`
			SELECT COUNT(DISTINCT user_email)::int AS count
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
			  AND user_email IS NOT NULL
		`) as Array<{ count: number }>;
		return row?.count ?? 0;
	}

	async getSkillsTable(days: number): Promise<SkillTableRow[]> {
		const rows = await this.db.execute(sql`
			WITH skill_plugin_status AS (
			  SELECT
			    ps.skill_name,
			    BOOL_AND(p.status = 'removed') AS all_removed
			  FROM plugin_skills ps
			  JOIN plugins p ON p.plugin_name = ps.plugin_name
			  GROUP BY ps.skill_name
			)
			SELECT
			  e.attributes->>'skill.name' AS skill_name,
			  MIN(e.attributes->>'skill.source') AS skill_source,
			  COUNT(*)::int AS total,
			  COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
			  COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
			  COUNT(*) FILTER (WHERE e.attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill,
			  array_remove(array_agg(DISTINCT e.attributes->>'marketplace.name'), NULL) AS marketplace_names,
			  CASE WHEN sps.all_removed IS TRUE THEN 'removed' ELSE NULL END AS status
			FROM events e
			LEFT JOIN skill_plugin_status sps ON sps.skill_name = e.attributes->>'skill.name'
			WHERE e.event_name = 'claude_code.skill_activated'
			  AND e.timestamp >= NOW() - (${days} || ' days')::interval
			  AND e.attributes->>'skill.name' IS NOT NULL
			GROUP BY 1, sps.all_removed
			ORDER BY total DESC
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
}
