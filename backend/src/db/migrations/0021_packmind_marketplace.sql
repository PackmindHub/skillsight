-- Hand-authored: drizzle-kit migrate:generate is blocked by interactive rename-
-- detection prompts in this repo (snapshot drift since 0002). Continuing the
-- established pattern of hand-rolled, idempotent SQL (see 0018/0019 headers).
--
-- Adds support for Packmind marketplace sources alongside the existing git ones:
--   1. marketplace_sources.kind: discriminator column ('git' | 'packmind').
--   2. marketplace_sources.git_url: relax NOT NULL — Packmind sources have none.
--   3. marketplaces.provider: drives provider-specific UI display.
--   4. external_skill_plugin_mappings: drives ingest-time retro-association of
--      orphan skills to their owning Packmind plugin, since Packmind telemetry
--      does not natively carry plugin.name on skill events.
--
-- All statements idempotent — safe to re-run on a partially-applied DB.

ALTER TABLE "marketplace_sources"
  ADD COLUMN IF NOT EXISTS "kind" varchar(20) NOT NULL DEFAULT 'git';

ALTER TABLE "marketplace_sources"
  ALTER COLUMN "git_url" DROP NOT NULL;

ALTER TABLE "marketplaces"
  ADD COLUMN IF NOT EXISTS "provider" varchar(20) NOT NULL DEFAULT 'git';

CREATE TABLE IF NOT EXISTS "external_skill_plugin_mappings" (
  "skill_name" varchar(255) NOT NULL,
  "plugin_name" varchar(255) NOT NULL,
  "marketplace_name" varchar(255) NOT NULL,
  "source_id" uuid NOT NULL,
  "synced_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "external_skill_plugin_mappings_pkey" PRIMARY KEY ("skill_name"),
  CONSTRAINT "external_skill_plugin_mappings_source_id_fk"
    FOREIGN KEY ("source_id") REFERENCES "marketplace_sources"("id") ON DELETE CASCADE
);
