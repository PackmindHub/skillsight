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
	| "integration_paused"
	| "integration_resumed"
	| "integration_sync_triggered"
	| "integration_sync_completed"
	| "integration_cursor_reset"
	| "marketplace_status_changed"
	| "marketplace_updated"
	| "marketplace_deleted"
	| "marketplace_source_created"
	| "marketplace_source_updated"
	| "marketplace_source_deleted"
	| "marketplace_source_sync_triggered"
	| "marketplace_source_sync_completed"
	| "plugin_status_changed";

export const ALL_AUDIT_ACTIONS: readonly AuditAction[] = [
	"login",
	"logout",
	"token_created",
	"token_revoked",
	"allowlist_added",
	"allowlist_removed",
	"integration_created",
	"integration_updated",
	"integration_deleted",
	"integration_data_cleared",
	"integration_paused",
	"integration_resumed",
	"integration_sync_triggered",
	"integration_sync_completed",
	"integration_cursor_reset",
	"marketplace_status_changed",
	"marketplace_updated",
	"marketplace_deleted",
	"marketplace_source_created",
	"marketplace_source_updated",
	"marketplace_source_deleted",
	"marketplace_source_sync_triggered",
	"marketplace_source_sync_completed",
	"plugin_status_changed",
] as const;

export interface AuditEntry {
	id: number;
	actorEmail: string | null;
	action: AuditAction;
	target: string | null;
	timestamp: Date;
	metadata: Record<string, unknown> | null;
}

export interface AuditFilters {
	actorEmail?: string;
	actions?: AuditAction[];
	target?: string;
	from?: Date;
	to?: Date;
	search?: string;
}

export interface AuditDiffMetadata {
	before: Record<string, unknown>;
	after: Record<string, unknown>;
	changedFields: string[];
	[key: string]: unknown;
}

export interface AuditSyncMetadata {
	mode: "manual" | "scheduled";
	durationMs?: number;
	pluginCount?: number;
	skillCount?: number;
	error?: string | null;
}
