import type { AuditAction, AuditEntry, AuditFilters } from "@/domain/audit";

export interface IAuditRepository {
	log(entry: {
		actorEmail: string | null;
		action: AuditAction;
		target?: string | null;
		metadata?: Record<string, unknown>;
	}): Promise<void>;
	list(
		filters: AuditFilters,
		page: number,
		limit: number,
	): Promise<{ items: AuditEntry[]; total: number }>;
	listAll(filters: AuditFilters, max: number): Promise<AuditEntry[]>;
}
