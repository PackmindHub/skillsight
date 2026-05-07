import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function getShadowSkills() {
	const rows = await db.execute(sql`
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
	return rows as unknown as Array<{
		skill_name: string;
		count: number;
		first_seen: string;
		last_seen: string;
		distinct_users: number;
	}>;
}
