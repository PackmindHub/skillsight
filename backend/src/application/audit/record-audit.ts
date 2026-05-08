import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditAction } from "@/domain/audit";

export async function recordAudit(
	deps: { audit: IAuditRepository },
	entry: {
		actorEmail: string | null;
		action: AuditAction;
		target?: string | null;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		await deps.audit.log(entry);
	} catch (err) {
		// Audit logging must never make a mutation fail.
		console.error(`[audit] failed to record ${entry.action} on ${entry.target}:`, err);
	}
}
