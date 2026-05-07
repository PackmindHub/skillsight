import { Hono } from "hono";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listAuditEvents } from "@/application/audit/list-audit-events";

export function createAuditRoute(deps: Pick<AppDeps, "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10)));
		return c.json(await listAuditEvents(deps, { page, limit }));
	});

	return route;
}
