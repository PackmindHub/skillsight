import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";

type AuditAction =
	| "login"
	| "logout"
	| "token_created"
	| "token_revoked"
	| "allowlist_added"
	| "allowlist_removed"
	| "integration_created"
	| "integration_updated"
	| "integration_deleted";

export async function logAuditEvent(params: {
	actorEmail: string | null;
	action: AuditAction;
	target?: string;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await db.insert(auditEvents).values({
		actorEmail: params.actorEmail,
		action: params.action,
		target: params.target,
		metadata: params.metadata ?? null,
		timestamp: new Date(),
	});
}
