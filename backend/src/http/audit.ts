import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { listAuditEvents } from "@/application/audit/list-audit-events";
import { exportAuditEventsCsv } from "@/application/audit/export-audit-events";
import { ALL_AUDIT_ACTIONS, type AuditAction, type AuditFilters } from "@/domain/audit";

const ACTION_SET = new Set<string>(ALL_AUDIT_ACTIONS);

const filtersSchema = z.object({
	actor: z.string().trim().min(1).max(255).optional(),
	action: z
		.union([z.string(), z.array(z.string())])
		.optional()
		.transform((v) => {
			if (v === undefined) return undefined;
			const arr = Array.isArray(v) ? v : [v];
			const valid = arr.filter((a): a is AuditAction => ACTION_SET.has(a));
			return valid.length > 0 ? valid : undefined;
		}),
	target: z.string().trim().min(1).max(500).optional(),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	search: z.string().trim().min(1).max(200).optional(),
});

function parseFilters(query: Record<string, string | string[] | undefined>): AuditFilters {
	const parsed = filtersSchema.parse(query);
	const filters: AuditFilters = {};
	if (parsed.actor) filters.actorEmail = parsed.actor;
	if (parsed.action) filters.actions = parsed.action;
	if (parsed.target) filters.target = parsed.target;
	if (parsed.search) filters.search = parsed.search;
	if (parsed.from) filters.from = new Date(parsed.from);
	if (parsed.to) filters.to = new Date(parsed.to);
	if (filters.from && filters.to && filters.from > filters.to) {
		throw new Error("`from` must be earlier than `to`");
	}
	return filters;
}

function readQueryRecord(c: { req: { queries: () => Record<string, string[] | undefined> } }) {
	const all = c.req.queries();
	const out: Record<string, string | string[] | undefined> = {};
	for (const [k, v] of Object.entries(all)) {
		if (!v) continue;
		out[k] = v.length === 1 ? v[0] : v;
	}
	return out;
}

export function createAuditRoute(deps: Pick<AppDeps, "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);

	route.get("/", async (c) => {
		const queries = readQueryRecord(c);
		const filters = parseFilters(queries);
		const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10));
		const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query("limit") ?? "50", 10)));
		return c.json(await listAuditEvents(deps, { filters, page, limit }));
	});

	route.get("/export", async (c) => {
		const queries = readQueryRecord(c);
		const filters = parseFilters(queries);
		const csv = await exportAuditEventsCsv(deps, filters);
		const filename = `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
		c.header("Content-Type", "text/csv; charset=utf-8");
		c.header("Content-Disposition", `attachment; filename="${filename}"`);
		return c.body(csv);
	});

	route.get("/actions", (c) => c.json({ actions: ALL_AUDIT_ACTIONS }));

	return route;
}
