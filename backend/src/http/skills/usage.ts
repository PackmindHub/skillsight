import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { getUsageStats } from "@/application/skills/get-usage-stats";
import { getSkillsTable } from "@/application/skills/get-skills-table";
import { getMonthlyTrends } from "@/application/skills/get-monthly-trends";
import type { DaysWindow } from "@/domain/ports/skill-repository";

function parseDays(raw: string | undefined): DaysWindow | { error: string } {
	if (raw === "all") return "all";
	const parsed = Number.parseInt(raw ?? "30", 10);
	if (Number.isNaN(parsed)) return { error: "Invalid days parameter" };
	return Math.min(365, Math.max(1, parsed));
}

export function createUsageRoute(deps: Pick<AppDeps, "skills" | "marketplaces">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const days = parseDays(c.req.query("days"));
		if (typeof days === "object") return c.json(days, 400);
		return c.json(await getUsageStats(deps, { days }));
	});

	route.get("/table", async (c) => {
		const days = parseDays(c.req.query("days"));
		if (typeof days === "object") return c.json(days, 400);
		return c.json({ rows: await getSkillsTable(deps, { days }) });
	});

	route.get("/monthly", async (c) => {
		return c.json(await getMonthlyTrends(deps));
	});

	return route;
}
