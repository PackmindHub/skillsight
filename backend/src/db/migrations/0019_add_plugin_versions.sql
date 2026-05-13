-- Hand-authored: drizzle-kit migrate:generate is non-functional in this repo
-- (snapshot drift since 0002; see 0018 header). Continuing the established
-- pattern of hand-rolled, idempotent SQL.
--
-- Adds the `plugin_versions` table to track every distinct version observed
-- per (plugin_name, marketplace_name) pair. See domain/plugin.ts.
--
-- The composite PK enforces that version strings are namespaced by the owning
-- plugin: `1.2.3` of plugin-a in marketplace alpha is unrelated to `1.2.3` of
-- plugin-a in marketplace beta or of plugin-b. `marketplace_name` uses '' as
-- the no-marketplace sentinel so the PK can stay non-null (matches the same
-- pattern used by `skills.plugin_name` in 0010_skills.sql).
--
-- All statements idempotent — safe to re-run on a partially-applied DB.

CREATE TABLE IF NOT EXISTS "plugin_versions" (
  "plugin_name" varchar(255) NOT NULL,
  "marketplace_name" varchar(255) NOT NULL DEFAULT '',
  "version" varchar(100) NOT NULL,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("plugin_name", "marketplace_name", "version")
);

CREATE INDEX IF NOT EXISTS "plugin_versions_plugin_idx"
  ON "plugin_versions" ("plugin_name", "marketplace_name");
