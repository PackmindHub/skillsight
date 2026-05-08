import { and, desc, eq, gte, lte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { auditEvents } from "@/db/schema";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditAction, AuditEntry, AuditFilters } from "@/domain/audit";
import { redactSecrets } from "@/infrastructure/audit/redact";

export class DrizzleAuditRepository implements IAuditRepository {
	constructor(private readonly db: AppDb) {}

	async log(entry: {
		actorEmail: string | null;
		action: AuditAction;
		target?: string | null;
		metadata?: Record<string, unknown>;
	}): Promise<void> {
		const safeMetadata =
			entry.metadata !== undefined
				? (redactSecrets(entry.metadata) as Record<string, unknown>)
				: null;
		await this.db.insert(auditEvents).values({
			actorEmail: entry.actorEmail,
			action: entry.action,
			target: entry.target ?? null,
			metadata: safeMetadata,
			timestamp: new Date(),
		});
	}

	async list(
		filters: AuditFilters,
		page: number,
		limit: number,
	): Promise<{ items: AuditEntry[]; total: number }> {
		const offset = (page - 1) * limit;
		const where = buildWhere(filters);

		const baseQuery = this.db.select().from(auditEvents);
		const filtered = where ? baseQuery.where(where) : baseQuery;

		const countSql = where
			? sql`SELECT COUNT(*)::int AS count FROM ${auditEvents} WHERE ${where}`
			: sql`SELECT COUNT(*)::int AS count FROM ${auditEvents}`;

		const [rows, countRows] = await Promise.all([
			filtered.orderBy(desc(auditEvents.timestamp)).limit(limit).offset(offset),
			this.db.execute(countSql) as Promise<Array<{ count: number }>>,
		]);
		const total = countRows[0]?.count ?? 0;
		return { items: rows as AuditEntry[], total };
	}

	async listAll(filters: AuditFilters, max: number): Promise<AuditEntry[]> {
		const where = buildWhere(filters);
		const baseQuery = this.db.select().from(auditEvents);
		const filtered = where ? baseQuery.where(where) : baseQuery;
		const rows = await filtered.orderBy(desc(auditEvents.timestamp)).limit(max);
		return rows as AuditEntry[];
	}
}

function buildWhere(filters: AuditFilters): SQL | undefined {
	const clauses: SQL[] = [];

	if (filters.actorEmail) clauses.push(eq(auditEvents.actorEmail, filters.actorEmail));
	if (filters.actions && filters.actions.length > 0)
		clauses.push(inArray(auditEvents.action, filters.actions));
	if (filters.target) clauses.push(ilike(auditEvents.target, `%${filters.target}%`));
	if (filters.from) clauses.push(gte(auditEvents.timestamp, filters.from));
	if (filters.to) clauses.push(lte(auditEvents.timestamp, filters.to));

	if (filters.search) {
		const pattern = `%${filters.search}%`;
		const searchClause = or(
			ilike(auditEvents.target, pattern),
			ilike(auditEvents.actorEmail, pattern),
			sql`${auditEvents.metadata}::text ILIKE ${pattern}`,
		);
		if (searchClause) clauses.push(searchClause);
	}

	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return and(...clauses);
}
