export interface ParsedEvent {
	userEmail: string | null;
	sessionId: string | null;
	eventName: string;
	timestamp: Date;
	attributes: Record<string, unknown>;
}

export interface NewEvent extends ParsedEvent {
	source: "direct" | "integration";
	sourceIntegrationId?: string | null;
}

export const CLAUDE_CODE_EVENT_PREFIX = "claude_code." as const;

export const SHORT_EVENT_NAMES = {
	SKILL_ACTIVATED: "skill_activated",
	PLUGIN_INSTALLED: "plugin_installed",
	PLUGIN_LOADED: "plugin_loaded",
} as const;

export const EVENT_NAMES = {
	SKILL_ACTIVATED: `${CLAUDE_CODE_EVENT_PREFIX}${SHORT_EVENT_NAMES.SKILL_ACTIVATED}`,
	PLUGIN_INSTALLED: `${CLAUDE_CODE_EVENT_PREFIX}${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}`,
	PLUGIN_LOADED: `${CLAUDE_CODE_EVENT_PREFIX}${SHORT_EVENT_NAMES.PLUGIN_LOADED}`,
} as const;

export const PREVIOUS_DEFAULT_LOKI_QUERIES = [
	// 0007 default: structured-metadata filter. Migration 0011 ran a SQL UPDATE
	// to rewrite this form on every existing row, but we keep it here as a
	// belt-and-braces runtime backfill for any row that lands on form-A via a
	// path that bypasses 0011 (e.g. manual seeding, a divergent importer).
	`{service_name="claude-code"} | event_name=~\`${SHORT_EVENT_NAMES.SKILL_ACTIVATED}|${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}\``,
	// 0011 default: log-line regex (`|~`), pre-plugin_loaded.
	`{service_name="claude-code"} |~ "${SHORT_EVENT_NAMES.SKILL_ACTIVATED}|${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}"`,
] as const;

export const DEFAULT_LOKI_QUERY = `{service_name="claude-code"} |~ "${SHORT_EVENT_NAMES.SKILL_ACTIVATED}|${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}|${SHORT_EVENT_NAMES.PLUGIN_LOADED}"`;
