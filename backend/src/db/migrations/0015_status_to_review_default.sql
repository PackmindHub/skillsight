-- Merge the "unknown" status bucket into "to_review" for both skills and
-- plugins. New rows now default to "to_review" instead of "unknown", and any
-- existing rows that still hold "unknown" are migrated. Bundled built-in
-- skills continue to display as "approved" via the `defaultBundledStatus`
-- helper, which now coerces "to_review" → "approved" instead of
-- "unknown" → "approved".
-- Idempotent: safe to re-run on a partially-applied DB.
ALTER TABLE "skills"  ALTER COLUMN "status" SET DEFAULT 'to_review';
ALTER TABLE "plugins" ALTER COLUMN "status" SET DEFAULT 'to_review';
UPDATE "skills"  SET "status" = 'to_review' WHERE "status" = 'unknown';
UPDATE "plugins" SET "status" = 'to_review' WHERE "status" = 'unknown';
