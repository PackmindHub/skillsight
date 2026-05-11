-- Re-run of 0012's data cleanup. Between 0012 and this migration, the Loki
-- integration sync path (`application/integrations/sync-integration.ts`) was
-- still upserting `marketplace.name="inline"` rows because it did not call
-- `normalizeMarketplaceName`. The companion code change in this PR fixes the
-- write path; this migration purges anything that snuck in since 0012.
-- Null out plugin references first, then remove the stray marketplace row.
-- Idempotent: safe to re-run on a partially-applied DB.
UPDATE "plugins" SET "marketplace_name" = NULL WHERE "marketplace_name" = 'inline';
DELETE FROM "marketplaces" WHERE "name" = 'inline';
