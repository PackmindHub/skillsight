import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { getCohorts } from "@/application/cohorts/get-cohorts";
import type { CohortsWindow } from "@/domain/ports/event-repository";

function parseWindow(raw: string | undefined): CohortsWindow | { error: string } {
	if (raw == null || raw === "all") return "all";
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) return { error: "Invalid days parameter" };
	return Math.min(365, Math.max(1, parsed));
}

export function createCohortsRoute(deps: Pick<AppDeps, "events">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const window = parseWindow(c.req.query("days"));
		if (typeof window === "object") return c.json(window, 400);
		return c.json(await getCohorts(deps, { window }));
	});

	return route;
}
