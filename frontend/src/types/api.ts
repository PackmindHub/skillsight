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
	skillName: string;
	count: number;
}

export interface DailyTrend {
	date: string;
	count: number;
}

export interface TopUser {
	userEmail: string;
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

export type DashboardPeriod = 7 | 30 | 90 | "all";

export interface MonthlyPoint {
	month: string;
	count: number;
}

export interface MonthlyTrendsResponse {
	invocations: MonthlyPoint[];
	uniqueSkills: MonthlyPoint[];
	uniqueUsers: MonthlyPoint[];
}


export type MarketplaceStatus = "to_review" | "approved" | "denied";

export type PluginStatus = "to_review" | "approved" | "removed";

export type SkillStatus = "to_review" | "approved" | "removed";

export const SKILL_STATUSES: readonly SkillStatus[] = [
	"to_review",
	"approved",
	"removed",
] as const;

export const PLUGIN_STATUSES: readonly PluginStatus[] = [
	"to_review",
	"approved",
	"removed",
] as const;

export const MARKETPLACE_STATUSES: readonly MarketplaceStatus[] = [
	"to_review",
	"approved",
	"denied",
] as const;

export interface Plugin {
	pluginName: string;
	marketplaceName: string | null;
	marketplaceStatus: MarketplaceStatus | null;
	pluginVersion: string | null;
	installTrigger: string | null;
	marketplaceIsOfficial: boolean | null;
	status: PluginStatus;
	firstSeenAt: string;
	lastSeenAt: string;
	installationCount: number;
	uniqueUserCount: number;
	skillCount: number;
	skillActivationCount: number;
	lastSkillActivationAt: string | null;
}

export interface PluginSkillRow {
	skillName: string;
	activationCount: number;
}

export interface PluginUserRow {
	userEmail: string;
	activationCount: number;
}

export interface PluginSkillsResponse {
	skills: PluginSkillRow[];
	topUsers: PluginUserRow[];
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
	pluginCount: number;
	knownSkillCount: number;
	activatedSkillCount: number;
	totalActivationCount: number;
}

export interface MarketplacePluginRow {
	pluginName: string;
	status: PluginStatus;
	pluginVersion: string | null;
	installationCount: number;
	skillActivationCount: number;
}

export interface MarketplaceSkillRow {
	skillName: string;
	pluginName: string;
	activationCount: number;
}

export interface MarketplaceDetailResponse {
	plugins: MarketplacePluginRow[];
	skills: MarketplaceSkillRow[];
}

export interface SkillTableRow {
	skillName: string;
	pluginName: string | null;
	skillSource: string | null;
	total: number;
	uniqueUsers: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: number[];
	marketplaces: MarketplaceRef[];
	status: SkillStatus;
	lastSeenAt: string | null;
}

export interface SkillsTableResponse {
	rows: SkillTableRow[];
}

export interface SkillDetailTopUser {
	userEmail: string;
	count: number;
}

export interface SkillDetailPluginRef {
	pluginName: string;
	marketplaceName: string | null;
	status: string;
}

export interface SkillDetail {
	skillName: string;
	skillSource: string | null;
	total: number;
	uniqueUsers: number;
	userSlash: number;
	claudeProactive: number;
	nestedSkill: number;
	dailyCounts: { date: string; count: number }[];
	topUsers: SkillDetailTopUser[];
	firstSeenAt: string | null;
	lastSeenAt: string | null;
	marketplaces: MarketplaceRef[];
	plugins: SkillDetailPluginRef[];
	status: SkillStatus;
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

export interface AuditFilters {
	actor?: string;
	actions?: string[];
	target?: string;
	from?: string;
	to?: string;
	search?: string;
}

export interface AuditDiffMetadata {
	before: Record<string, unknown>;
	after: Record<string, unknown>;
	changedFields: string[];
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

export interface LiveSkillActivatedEvent {
	id: string;
	timestamp: string;
	userEmail: string | null;
	sessionId: string | null;
	skillName: string;
	pluginName: string | null;
	marketplaceName: string | null;
	trigger: string | null;
}

export interface LiveEventsResponse {
	events: LiveSkillActivatedEvent[];
}
