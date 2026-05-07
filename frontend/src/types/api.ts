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

export interface ShadowSkill {
	skill_name: string;
	count: number;
	first_seen: string;
	last_seen: string;
	distinct_users: number;
}

export interface AllowedSkill {
	skillName: string;
	source: string | null;
	addedAt: string;
	addedBy: string | null;
}

export type MarketplaceStatus = "to_review" | "approved" | "denied";

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
}

export interface SkillTableRow {
	skill_name: string;
	total: number;
	user_slash: number;
	claude_proactive: number;
	nested_skill: number;
	marketplaces: MarketplaceRef[];
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
