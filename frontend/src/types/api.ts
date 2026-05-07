export interface User {
	id: string;
	email: string;
	role: string;
}

export interface Token {
	id: string;
	jti: string;
	name: string;
	userLabel: string | null;
	createdAt: string;
	expiresAt: string | null;
	revokedAt: string | null;
	expiresSoon?: boolean;
}

export interface SkillUsageStat {
	skill_name: string;
	count: number;
}

export interface DailyTrend {
	date: string;
	count: number;
}

export interface TopUser {
	user_email: string;
	count: number;
}

export interface TriggerBreakdown {
	trigger: string | null;
	count: number;
}

export interface UsageStats {
	totalActivations: number;
	uniqueSkills: number;
	activeUsers: number;
}

export interface UsageResponse {
	topSkills: SkillUsageStat[];
	dailyTrend: DailyTrend[];
	topUsers: TopUser[];
	byTrigger: TriggerBreakdown[];
	stats: UsageStats;
}


export type MarketplaceStatus = "to_review" | "approved" | "denied";

export type PluginStatus = "unknown" | "to_review" | "approved" | "removed";

export interface Plugin {
	pluginName: string;
	marketplaceName: string | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	status: PluginStatus;
	firstSeenAt: string;
	lastSeenAt: string;
	installationCount: number;
	uniqueUserCount: number;
}

export interface MarketplaceRef {
	name: string;
	status: MarketplaceStatus;
}

export interface Marketplace extends MarketplaceRef {
	url: string | null;
	description: string | null;
	firstSeenAt: string;
	lastSeenAt: string;
	activationCount: number;
	pluginInstallCount: number;
	skillActivatedLinkedCount: number;
}

export interface SkillTableRow {
	skill_name: string;
	skillSource: string | null;
	total: number;
	user_slash: number;
	claude_proactive: number;
	nested_skill: number;
	marketplaces: MarketplaceRef[];
	status?: "removed" | null;
}

export interface SkillsTableResponse {
	rows: SkillTableRow[];
}

export interface AuditEvent {
	id: number;
	actorEmail: string | null;
	action: string;
	target: string | null;
	timestamp: string;
	metadata: Record<string, unknown> | null;
}

export interface AuditResponse {
	items: AuditEvent[];
	total: number;
	page: number;
	limit: number;
}

export interface MarketplaceSource {
	id: string;
	gitUrl: string;
	hasToken: boolean;
	branch: string | null;
	marketplaceName: string | null;
	syncIntervalMs: number;
	enabled: boolean;
	importPluginsAndSkills: boolean;
	lastSyncAt: string | null;
	lastSyncError: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Integration {
	id: string;
	type: "loki";
	name: string;
	url: string;
	authType: "none" | "basic";
	authUsername: string | null;
	hasPassword: boolean;
	lokiQuery: string;
	syncIntervalMs: number;
	enabled: boolean;
	lastSyncAt: string | null;
	lastSyncError: string | null;
	createdAt: string;
	updatedAt: string;
	eventCount: number;
}

export interface IntegrationPreviewEvent {
	eventName: string;
	userEmail: string | null;
	timestamp: string;
	attributes: Record<string, unknown>;
}
