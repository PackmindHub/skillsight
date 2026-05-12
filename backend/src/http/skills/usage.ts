import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { getUsageStats } from "@/application/skills/get-usage-stats";
import { getSkillsTable } from "@/application/skills/get-skills-table";
import { getSkillDetail } from "@/application/skills/get-skill-detail";
import { getMonthlyTrends } from "@/application/skills/get-monthly-trends";
import type { TimeWindow } from "@/domain/ports/skill-repository";

const RANGE_MAX_DAYS = 365;
const DAY_MS = 86_400_000;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function parseTimeWindow(
	query: { days?: string; from?: string; to?: string },
): TimeWindow | { error: string } {
	const { days, from, to } = query;
	if ((from && !to) || (!from && to)) {
		return { error: "`from` and `to` must be provided together" };
	}
	if (from && to) {
		const f = isoDate.safeParse(from);
		const t = isoDate.safeParse(to);
		if (!f.success || !t.success) {
			return { error: "`from` and `to` must be YYYY-MM-DD dates" };
		}
		// Dates are interpreted at UTC midnight. `to` is the last day the user
		// wants included, so we add a day to make the upper bound exclusive.
		// A user in a non-UTC timezone gets a ±1-day skew at range edges; we
		// accept that for the simplicity of day-level filtering.
		const fromDate = new Date(`${from}T00:00:00Z`);
		const toDate = new Date(`${to}T00:00:00Z`);
		if (fromDate.getTime() > toDate.getTime()) {
			return { error: "`from` must be earlier than or equal to `to`" };
		}
		const toExclusive = new Date(toDate.getTime() + DAY_MS);
		const spanDays = Math.round((toExclusive.getTime() - fromDate.getTime()) / DAY_MS);
		if (spanDays > RANGE_MAX_DAYS) {
			return { error: `Date range cannot exceed ${RANGE_MAX_DAYS} days` };
		}
		return { kind: "range", from: fromDate, to: toExclusive };
	}
	if (days === "all") return { kind: "preset", days: "all" };
	const parsed = Number.parseInt(days ?? "30", 10);
	if (Number.isNaN(parsed)) return { error: "Invalid days parameter" };
	return { kind: "preset", days: Math.min(365, Math.max(1, parsed)) };
}

export function createUsageRoute(deps: Pick<AppDeps, "skills" | "marketplaces">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const window = parseTimeWindow({
			days: c.req.query("days"),
			from: c.req.query("from"),
			to: c.req.query("to"),
		});
		if ("error" in window) return c.json(window, 400);
		return c.json(await getUsageStats(deps, { window }));
	});

	route.get("/table", async (c) => {
		const window = parseTimeWindow({
			days: c.req.query("days"),
			from: c.req.query("from"),
			to: c.req.query("to"),
		});
		if ("error" in window) return c.json(window, 400);
		const includeIgnored = c.req.query("includeIgnored") === "1";
		return c.json({ rows: await getSkillsTable(deps, { window, includeIgnored }) });
	});

	route.get("/detail", async (c) => {
		const window = parseTimeWindow({
			days: c.req.query("days"),
			from: c.req.query("from"),
			to: c.req.query("to"),
		});
		if ("error" in window) return c.json(window, 400);
		const skillName = c.req.query("skill");
		if (!skillName) return c.json({ error: "Missing skill parameter" }, 400);
		const detail = await getSkillDetail(deps, { skillName, window });
		if (!detail) return c.json({ error: "Skill not found" }, 404);
		return c.json(detail);
	});

	route.get("/monthly", async (c) => {
		return c.json(await getMonthlyTrends(deps));
	});

	return route;
}
