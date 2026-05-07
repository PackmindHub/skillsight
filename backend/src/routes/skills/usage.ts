import { Hono } from "hono";
import { db } from "@/db/client";
import { marketplaces } from "@/db/schema";
import { sessionAuth } from "@/middleware/session-auth";
import type { AppVariables } from "@/types";
import {
	getTopSkills,
	getDailyTrend,
	getTopUsers,
	getByTrigger,
	getTotalActivations,
	getUniqueSkillsCount,
	getActiveUsersCount,
	getSkillsTable,
} from "@/queries/skills-usage";

export const usageRoute = new Hono<{ Variables: AppVariables }>();
usageRoute.use("*", sessionAuth);

usageRoute.get("/", async (c) => {
	const daysParam = c.req.query("days");
	const days = Math.min(365, Math.max(1, Number.parseInt(daysParam ?? "30", 10)));
	if (Number.isNaN(days)) return c.json({ error: "Invalid days parameter" }, 400);

	const [topSkills, dailyTrend, topUsers, byTrigger, totalActivations, uniqueSkills, activeUsers] =
		await Promise.all([
			getTopSkills(days),
			getDailyTrend(days),
			getTopUsers(days),
			getByTrigger(days),
			getTotalActivations(days),
			getUniqueSkillsCount(days),
			getActiveUsersCount(days),
		]);

	return c.json({
		topSkills,
		dailyTrend,
		topUsers,
		byTrigger,
		stats: { totalActivations, uniqueSkills, activeUsers },
	});
});

usageRoute.get("/table", async (c) => {
	const daysParam = c.req.query("days");
	const days = Math.min(365, Math.max(1, Number.parseInt(daysParam ?? "30", 10)));
	if (Number.isNaN(days)) return c.json({ error: "Invalid days parameter" }, 400);

	const [rawRows, allMarketplaces] = await Promise.all([
		getSkillsTable(days),
		db.select({ name: marketplaces.name, status: marketplaces.status }).from(marketplaces),
	]);

	const mpStatusMap = new Map(allMarketplaces.map((m) => [m.name, m.status]));

	const rows = rawRows.map(({ marketplace_names, ...rest }) => ({
		...rest,
		marketplaces: (marketplace_names ?? []).map((name) => ({
			name,
			status: mpStatusMap.get(name) ?? "to_review",
		})),
	}));

	return c.json({ rows });
});
