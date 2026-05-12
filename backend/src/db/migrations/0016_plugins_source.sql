-- Add the `source` column to `plugins` to capture the plugin folder path
-- relative to the marketplace's git repo root (taken from marketplace.json's
-- `plugins[].source` field, with the leading "./" stripped at sync time).
-- Used by the skill drawer to build a direct link to the skill's source on
-- GitHub/GitLab/Bitbucket. Nullable: legacy rows synced before this column
-- existed keep it NULL until the next marketplace sync repopulates it.
-- Idempotent: safe to re-run on a partially-applied DB.
ALTER TABLE "plugins" ADD COLUMN IF NOT EXISTS "source" varchar(500);
