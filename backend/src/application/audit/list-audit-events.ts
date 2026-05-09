import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditEntry, AuditFilters } from "@/domain/audit";

export async function listAuditEvents(
	deps: { audit: IAuditRepository },
	input: { filters: AuditFilters; page: number; limit: number },
): Promise<{ items: AuditEntry[]; total: number; page: number; limit: number }> {
	const { items, total } = await deps.audit.list(input.filters, input.page, input.limit);
	return { items, total, page: input.page, limit: input.limit };
}
