import { desc, sql } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { auditEvents } from "@/db/schema";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditAction, AuditEntry } from "@/domain/audit";

export class DrizzleAuditRepository implements IAuditRepository {
	constructor(private readonly db: AppDb) {}

	async log(entry: {
		actorEmail: string | null;
		action: AuditAction;
		target?: string;
		metadata?: Record<string, unknown>;
	}): Promise<void> {
		await this.db.insert(auditEvents).values({
			actorEmail: entry.actorEmail,
			action: entry.action,
			target: entry.target,
			metadata: entry.metadata ?? null,
			timestamp: new Date(),
		});
	}

	async listPaginated(
		page: number,
		limit: number,
	): Promise<{ items: AuditEntry[]; total: number }> {
		const offset = (page - 1) * limit;
		const [rows, [{ count }]] = await Promise.all([
			this.db
				.select()
				.from(auditEvents)
				.orderBy(desc(auditEvents.timestamp))
				.limit(limit)
				.offset(offset),
			this.db.execute(sql`SELECT COUNT(*)::int AS count FROM audit_events`) as Promise<
				Array<{ count: number }>
			>,
		]);
		return { items: rows as AuditEntry[], total: count ?? 0 };
	}
}
