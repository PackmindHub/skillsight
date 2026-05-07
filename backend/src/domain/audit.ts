export type AuditAction =
	| "login"
	| "logout"
	| "token_created"
	| "token_revoked"
	| "allowlist_added"
	| "allowlist_removed"
	| "integration_created"
	| "integration_updated"
	| "integration_deleted"
	| "integration_data_cleared"
	| "marketplace_status_changed"
	| "marketplace_updated";

export interface AuditEntry {
	id: number;
	actorEmail: string | null;
	action: AuditAction;
	target: string | null;
	timestamp: Date;
	metadata: Record<string, unknown> | null;
}
