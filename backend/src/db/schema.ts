import { sql } from "drizzle-orm";
import {
	bigserial,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { DEFAULT_LOKI_QUERY, EVENT_NAMES } from "@/domain/event";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	role: varchar("role", { length: 50 }).notNull().default("admin"),
	onboardingCompletedAt: timestamp("onboarding_completed_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tokens = pgTable("tokens", {
	id: uuid("id").defaultRandom().primaryKey(),
	jti: varchar("jti", { length: 36 }).notNull().unique(),
	name: varchar("name", { length: 255 }).notNull(),
	userLabel: varchar("user_label", { length: 255 }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at"),
	revokedAt: timestamp("revoked_at"),
});

export const events = pgTable(
	"events",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		userEmail: varchar("user_email", { length: 255 }),
		sessionId: varchar("session_id", { length: 255 }),
		eventName: varchar("event_name", { length: 255 }).notNull(),
		timestamp: timestamp("timestamp").notNull(),
		attributes: jsonb("attributes"),
		source: varchar("source", { length: 20 }).notNull().default("direct"),
		sourceIntegrationId: uuid("source_integration_id").references(() => integrations.id, {
			onDelete: "set null",
		}),
	},
	(table) => [
		uniqueIndex("events_dedup_idx").on(
			table.timestamp,
			table.userEmail,
			table.sessionId,
			table.eventName,
		),
		index("events_event_name_ts_idx").on(table.eventName, table.timestamp),
		index("events_session_id_idx").on(table.sessionId),
		index("events_user_email_ts_idx").on(table.userEmail, table.timestamp),
		index("events_source_ts_idx").on(table.source, table.timestamp),
		index("events_source_integration_id_idx").on(table.sourceIntegrationId),
	],
);


export const auditEvents = pgTable(
	"audit_events",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		actorEmail: varchar("actor_email", { length: 255 }),
		action: varchar("action", { length: 100 }).notNull(),
		target: varchar("target", { length: 500 }),
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		metadata: jsonb("metadata"),
	},
	(table) => [
		index("audit_events_timestamp_idx").on(table.timestamp),
		index("audit_events_action_ts_idx").on(table.action, table.timestamp),
		index("audit_events_actor_ts_idx").on(table.actorEmail, table.timestamp),
	],
);

export const revokedTokens = pgTable("revoked_tokens", {
	jti: varchar("jti", { length: 36 }).primaryKey(),
	revokedAt: timestamp("revoked_at").defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
	id: uuid("id").defaultRandom().primaryKey(),
	type: varchar("type", { length: 50 }).notNull().default("loki"),
	name: varchar("name", { length: 255 }).notNull(),
	url: varchar("url", { length: 1000 }).notNull(),
	authType: varchar("auth_type", { length: 20 }).notNull().default("none"),
	authUsername: varchar("auth_username", { length: 255 }),
	authPasswordEncrypted: text("auth_password_encrypted"),
	lokiQuery: varchar("loki_query", { length: 500 }).notNull().default(DEFAULT_LOKI_QUERY),
	syncIntervalMs: integer("sync_interval_ms").notNull().default(30000),
	enabled: boolean("enabled").notNull().default(true),
	lastSyncAt: timestamp("last_sync_at"),
	lastSyncError: text("last_sync_error"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const plugins = pgTable("plugins", {
	pluginName: varchar("plugin_name", { length: 255 }).primaryKey(),
	marketplaceName: varchar("marketplace_name", { length: 255 }),
	pluginVersion: varchar("plugin_version", { length: 100 }),
	installTrigger: varchar("install_trigger", { length: 20 }),
	marketplaceIsOfficial: boolean("marketplace_is_official"),
	source: varchar("source", { length: 500 }),
	status: varchar("status", { length: 20 }).notNull().default("to_review"),
	firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

export const marketplaceSources = pgTable("marketplace_sources", {
	id: uuid("id").defaultRandom().primaryKey(),
	kind: varchar("kind", { length: 20 }).notNull().default("git"),
	gitUrl: varchar("git_url", { length: 1000 }),
	provider: varchar("provider", { length: 20 }).notNull().default("auto"),
	accessTokenEncrypted: text("access_token_encrypted"),
	branch: varchar("branch", { length: 255 }),
	marketplaceName: varchar("marketplace_name", { length: 255 }),
	syncIntervalMs: integer("sync_interval_ms").notNull().default(3600000),
	enabled: boolean("enabled").notNull().default(true),
	importPluginsAndSkills: boolean("import_plugins_and_skills").notNull().default(false),
	lastSyncAt: timestamp("last_sync_at"),
	lastSyncError: text("last_sync_error"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketplaces = pgTable("marketplaces", {
	name: varchar("name", { length: 255 }).primaryKey(),
	status: varchar("status", { length: 20 }).notNull().default("to_review"),
	provider: varchar("provider", { length: 20 }).notNull().default("git"),
	url: varchar("url", { length: 1000 }),
	description: text("description"),
	firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// Partial functional index for skill name lookups (created manually in migration)
export const skillNamePartialIndexSql = sql`
  CREATE INDEX IF NOT EXISTS events_skill_name_partial_idx
  ON events ((attributes->>'skill.name'), timestamp)
  WHERE event_name = ${EVENT_NAMES.SKILL_ACTIVATED}
`;

// Partial functional index for plugin name lookups (created manually in migration)
export const eventsPluginLoadedPartialIndexSql = sql`
  CREATE INDEX IF NOT EXISTS events_plugin_loaded_partial_idx
  ON events ((attributes->>'plugin.name'), timestamp)
  WHERE event_name = ${EVENT_NAMES.PLUGIN_LOADED}
`;

export const pluginSkills = pgTable(
	"plugin_skills",
	{
		pluginName: varchar("plugin_name", { length: 255 })
			.notNull()
			.references(() => plugins.pluginName),
		skillName: varchar("skill_name", { length: 255 }).notNull(),
		firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
		lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.pluginName, t.skillName] }),
		index("plugin_skills_skill_name_idx").on(t.skillName),
	],
);

// Status/ownership table for skills. One row per distinct skill identity, where
// identity is the full tuple (skill_name, plugin_name, marketplace_name,
// skill_source). The same plugin-less skill seen from user settings vs project
// settings are independent rows with independent status — '' is the
// no-plugin/no-marketplace/unknown-source bucket so the PK stays non-null without
// NULLS NOT DISTINCT (same convention as plugin_versions.marketplace_name).
// Analytics (counts, marketplaceNames) are derived from the event stream at query
// time — only status, first/last seen live here.
export const skills = pgTable(
	"skills",
	{
		skillName: varchar("skill_name", { length: 255 }).notNull(),
		pluginName: varchar("plugin_name", { length: 255 }).notNull().default(""),
		marketplaceName: varchar("marketplace_name", { length: 255 }).notNull().default(""),
		// Wire value of the `skill.source` OTLP attribute
		// (bundled | userSettings | projectSettings | plugin); '' when absent.
		skillSource: varchar("skill_source", { length: 32 }).notNull().default(""),
		status: varchar("status", { length: 20 }).notNull().default("to_review"),
		firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({
			columns: [t.skillName, t.pluginName, t.marketplaceName, t.skillSource],
		}),
		index("skills_status_idx").on(t.status),
		index("skills_plugin_name_idx").on(t.pluginName),
	],
);

// Tracks every distinct plugin version observed via plugin_installed /
// plugin_loaded events. The composite PK enforces that version strings are
// namespaced by the owning (plugin_name, marketplace_name) pair — `1.2.3` of
// plugin-a in marketplace alpha is unrelated to `1.2.3` of plugin-a in
// marketplace beta or of plugin-b. `marketplace_name` uses '' (not NULL) as the
// no-marketplace bucket so the PK can stay non-null without NULLS NOT DISTINCT.
// No FK to `plugins` on purpose: real plugin identity is the (name, marketplace)
// pair while the catalog PK is just `name`, so an FK would lie. Versions are
// recorded from event stream alone.
export const pluginVersions = pgTable(
	"plugin_versions",
	{
		pluginName: varchar("plugin_name", { length: 255 }).notNull(),
		marketplaceName: varchar("marketplace_name", { length: 255 }).notNull().default(""),
		version: varchar("version", { length: 100 }).notNull(),
		firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pluginName, t.marketplaceName, t.version] }),
		index("plugin_versions_plugin_idx").on(t.pluginName, t.marketplaceName),
	],
);

// Drives ingest-time retro-association of skills to plugins for sources whose
// telemetry events don't natively carry plugin.name (e.g. Packmind). Populated
// at marketplace-source sync time. Composite PK (skill_name, plugin_name,
// marketplace_name) so the same skill can legitimately belong to several plugins
// (a single-column skill_name PK trips "ON CONFLICT DO UPDATE command cannot
// affect row a second time" the moment one sync batch carries a skill twice).
// The ingest-time mapping cache is keyed on skill_name alone and stays
// single-winner: when a skill maps to multiple plugins, the cache resolves to one
// (last loaded wins) since plugin-less telemetry can't disambiguate.
export const externalSkillPluginMappings = pgTable(
	"external_skill_plugin_mappings",
	{
		skillName: varchar("skill_name", { length: 255 }).notNull(),
		pluginName: varchar("plugin_name", { length: 255 }).notNull(),
		marketplaceName: varchar("marketplace_name", { length: 255 }).notNull(),
		sourceId: uuid("source_id")
			.notNull()
			.references(() => marketplaceSources.id, { onDelete: "cascade" }),
		syncedAt: timestamp("synced_at").defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.skillName, t.pluginName, t.marketplaceName] })],
);
