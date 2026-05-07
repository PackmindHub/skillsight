import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { getUsageStats } from "@/application/skills/get-usage-stats";
import { getSkillsTable } from "@/application/skills/get-skills-table";

export function createUsageRoute(deps: Pick<AppDeps, "skills" | "marketplaces">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const daysParam = c.req.query("days");
		const days = Math.min(365, Math.max(1, Number.parseInt(daysParam ?? "30", 10)));
		if (Number.isNaN(days)) return c.json({ error: "Invalid days parameter" }, 400);
		return c.json(await getUsageStats(deps, { days }));
	});

	route.get("/table", async (c) => {
		const daysParam = c.req.query("days");
		const days = Math.min(365, Math.max(1, Number.parseInt(daysParam ?? "30", 10)));
		if (Number.isNaN(days)) return c.json({ error: "Invalid days parameter" }, 400);
		return c.json({ rows: await getSkillsTable(deps, { days }) });
	});

	return route;
}
