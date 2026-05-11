-- Data cleanup: Claude Code emits `marketplace.name="inline"` for plugins
-- installed locally on the user's workspace. The ingestion code now normalizes
-- this to NULL, but pre-existing rows still carry the literal "inline" value.
-- Null out the references first, then remove the stray marketplace row.
-- Idempotent: safe to re-run on a partially-applied DB.
UPDATE "plugins" SET "marketplace_name" = NULL WHERE "marketplace_name" = 'inline';
DELETE FROM "marketplaces" WHERE "name" = 'inline';
