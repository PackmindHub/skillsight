import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { allowedSkills } from "@/db/schema";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { AllowedSkill, ShadowSkill, SkillTableRow } from "@/domain/skill";

export class DrizzleSkillRepository implements ISkillRepository {
	constructor(private readonly db: AppDb) {}

	async listAllowed(): Promise<AllowedSkill[]> {
		return this.db.select().from(allowedSkills).orderBy(allowedSkills.skillName);
	}

	async addAllowed(data: {
		skillName: string;
		source: string;
		addedBy: string;
	}): Promise<AllowedSkill | null> {
		const [row] = await this.db
			.insert(allowedSkills)
			.values(data)
			.onConflictDoNothing()
			.returning();
		return row ?? null;
	}

	async removeAllowed(skillName: string): Promise<AllowedSkill | null> {
		const [deleted] = await this.db
			.delete(allowedSkills)
			.where(eq(allowedSkills.skillName, skillName))
			.returning();
		return deleted ?? null;
	}

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
			SELECT
			  attributes->>'skill.name' AS skill_name,
			  COUNT(*)::int AS total,
			  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'user-slash')::int AS user_slash,
			  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'claude-proactive')::int AS claude_proactive,
			  COUNT(*) FILTER (WHERE attributes->>'invocation_trigger' = 'nested-skill')::int AS nested_skill,
			  array_remove(array_agg(DISTINCT attributes->>'marketplace.name'), NULL) AS marketplace_names
			FROM events
			WHERE event_name = 'claude_code.skill_activated'
			  AND timestamp >= NOW() - (${days} || ' days')::interval
			  AND attributes->>'skill.name' IS NOT NULL
			GROUP BY 1
			ORDER BY total DESC
		`);
		return (
			rows as unknown as Array<{
				skill_name: string;
				total: number;
				user_slash: number;
				claude_proactive: number;
				nested_skill: number;
				marketplace_names: string[];
			}>
		).map((r) => ({
			skillName: r.skill_name,
			total: r.total,
			userSlash: r.user_slash,
			claudeProactive: r.claude_proactive,
			nestedSkill: r.nested_skill,
			marketplaceNames: r.marketplace_names ?? [],
		}));
	}

	async getShadowSkills(): Promise<ShadowSkill[]> {
		const rows = await this.db.execute(sql`
			SELECT
			  e.attributes->>'skill.name' AS skill_name,
			  COUNT(*)::int AS count,
			  MIN(e.timestamp) AS first_seen,
			  MAX(e.timestamp) AS last_seen,
			  COUNT(DISTINCT e.user_email)::int AS distinct_users
			FROM events e
			LEFT JOIN allowed_skills a ON a.skill_name = e.attributes->>'skill.name'
			WHERE e.event_name = 'claude_code.skill_activated'
			  AND e.attributes->>'skill.name' IS NOT NULL
			  AND a.skill_name IS NULL
			GROUP BY 1
			ORDER BY count DESC
		`);
		return (
			rows as unknown as Array<{
				skill_name: string;
				count: number;
				first_seen: string;
				last_seen: string;
				distinct_users: number;
			}>
		).map((r) => ({
			skillName: r.skill_name,
			count: r.count,
			firstSeen: r.first_seen,
			lastSeen: r.last_seen,
			distinctUsers: r.distinct_users,
		}));
	}
}
