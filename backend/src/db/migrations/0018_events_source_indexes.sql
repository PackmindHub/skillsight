-- Hand-authored: drizzle-kit migrate:generate is non-functional in this repo
-- (snapshots stop at 0002), so subsequent migrations are hand-rolled.
--
-- Adds two indexes on `events` to fix slow integration-page queries:
--
--   1. events_source_ts_idx (source, timestamp)
--      Backs `getDirectStats()` — SELECT COUNT(*), MAX(timestamp) WHERE source='direct'.
--      Without it, that query scanned the entire events table and took ~18s on
--      production volumes. Also speeds up `deleteDirectEvents()` (WHERE source='direct').
--
--   2. events_source_integration_id_idx (source_integration_id)
--      Backs `deleteByIntegrationId(id)`, `countEventsByIntegration` (GROUP BY id),
--      and `countEventsByIntegrationId(id)`. The FK was added in 0017 but no
--      index existed for lookups on this column.
--
-- Both statements are idempotent and safe to re-run.

CREATE INDEX IF NOT EXISTS "events_source_ts_idx"
  ON "events" ("source", "timestamp");

CREATE INDEX IF NOT EXISTS "events_source_integration_id_idx"
  ON "events" ("source_integration_id");
