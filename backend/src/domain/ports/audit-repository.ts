import type { AuditAction, AuditEntry } from "@/domain/audit";

export interface IAuditRepository {
	log(entry: {
		actorEmail: string | null;
		action: AuditAction;
		target?: string;
		metadata?: Record<string, unknown>;
	}): Promise<void>;
	listPaginated(
		page: number,
		limit: number,
	): Promise<{ items: AuditEntry[]; total: number }>;
}
