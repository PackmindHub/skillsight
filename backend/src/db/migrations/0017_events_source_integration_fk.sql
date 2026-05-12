-- Add a foreign key from `events.source_integration_id` to `integrations.id`
-- with `ON DELETE SET NULL`. Before this migration the column was a bare uuid:
-- deleting an integration row left its events with a dangling, non-resolvable
-- UUID. With SET NULL we keep historical events readable (source still =
-- "integration") but drop the pointer so they're cleanly orphaned.
--
-- Step 1: backfill — set source_integration_id = NULL for any event whose
-- pointer no longer resolves to an existing integration. Without this, the
-- ALTER TABLE below would fail on a DB that already accumulated orphans
-- before the FK existed.
--
-- Idempotent: re-runnable on a partially-applied DB.
UPDATE "events"
SET "source_integration_id" = NULL
WHERE "source_integration_id" IS NOT NULL
  AND "source_integration_id" NOT IN (SELECT "id" FROM "integrations");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_source_integration_id_integrations_id_fk'
  ) THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_source_integration_id_integrations_id_fk"
      FOREIGN KEY ("source_integration_id")
      REFERENCES "integrations" ("id")
      ON DELETE SET NULL;
  END IF;
END$$;
