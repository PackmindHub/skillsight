import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function getTopSkills(days: number) {
	const rows = await db.execute(sql`
		SELECT attributes->>'skill.name' AS skill_name, COUNT(*)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		  AND attributes->>'skill.name' IS NOT NULL
		GROUP BY 1
		ORDER BY count DESC
		LIMIT 10
	`);
	return rows as unknown as Array<{ skill_name: string; count: number }>;
}

export async function getDailyTrend(days: number) {
	const rows = await db.execute(sql`
		SELECT DATE_TRUNC('day', timestamp)::date AS date, COUNT(*)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		GROUP BY 1
		ORDER BY 1
	`);
	return rows as unknown as Array<{ date: string; count: number }>;
}

export async function getTopUsers(days: number) {
	const rows = await db.execute(sql`
		SELECT user_email, COUNT(*)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		  AND user_email IS NOT NULL
		GROUP BY user_email
		ORDER BY count DESC
		LIMIT 10
	`);
	return rows as unknown as Array<{ user_email: string; count: number }>;
}

export async function getByTrigger(days: number) {
	const rows = await db.execute(sql`
		SELECT attributes->>'invocation_trigger' AS trigger, COUNT(*)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		GROUP BY 1
		ORDER BY count DESC
	`);
	return rows as unknown as Array<{ trigger: string | null; count: number }>;
}

export async function getTotalActivations(days: number): Promise<number> {
	const [row] = await db.execute(sql`
		SELECT COUNT(*)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
	`) as Array<{ count: number }>;
	return row?.count ?? 0;
}

export async function getUniqueSkillsCount(days: number): Promise<number> {
	const [row] = await db.execute(sql`
		SELECT COUNT(DISTINCT attributes->>'skill.name')::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		  AND attributes->>'skill.name' IS NOT NULL
	`) as Array<{ count: number }>;
	return row?.count ?? 0;
}

export async function getActiveUsersCount(days: number): Promise<number> {
	const [row] = await db.execute(sql`
		SELECT COUNT(DISTINCT user_email)::int AS count
		FROM events
		WHERE event_name = 'claude_code.skill_activated'
		  AND timestamp >= NOW() - (${days} || ' days')::interval
		  AND user_email IS NOT NULL
	`) as Array<{ count: number }>;
	return row?.count ?? 0;
}

export async function getSkillsTable(days: number) {
	const rows = await db.execute(sql`
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
	return rows as unknown as Array<{
		skill_name: string;
		total: number;
		user_slash: number;
		claude_proactive: number;
		nested_skill: number;
		marketplace_names: string[];
	}>;
}
