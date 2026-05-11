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
} as const;

export const EVENT_NAMES = {
	SKILL_ACTIVATED: `${CLAUDE_CODE_EVENT_PREFIX}${SHORT_EVENT_NAMES.SKILL_ACTIVATED}`,
	PLUGIN_INSTALLED: `${CLAUDE_CODE_EVENT_PREFIX}${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}`,
} as const;

export const DEFAULT_LOKI_QUERY = `{service_name="claude-code"} |~ "${SHORT_EVENT_NAMES.SKILL_ACTIVATED}|${SHORT_EVENT_NAMES.PLUGIN_INSTALLED}"`;
