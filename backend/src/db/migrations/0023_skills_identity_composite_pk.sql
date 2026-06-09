-- Hand-authored: drizzle-kit migrate:generate is blocked by interactive rename-
-- detection prompts in this repo (snapshot drift since 0002 — see 0021 header).
--
-- Widens the skills status table identity from (skill_name, plugin_name) to the
-- full tuple (skill_name, plugin_name, marketplace_name, skill_source) so that the
-- same plugin-less skill observed from user settings vs project settings (and per
-- marketplace) are independent rows with independent approve/deny/ignore status.
--
-- '' is the no-marketplace / unknown-source bucket, mirroring plugin_name's
-- existing '' = no-plugin convention, so the PK stays non-null. Existing rows are
-- backfilled to ('', '') which is safe: the old PK already made (skill_name,
-- plugin_name) unique, so every row is unique under the wider key. New ingests
-- write the real marketplace_name / skill_source going forward.
--
-- All statements idempotent — safe to re-run on a partially-applied DB.

ALTER TABLE "skills"
  ADD COLUMN IF NOT EXISTS "marketplace_name" varchar(255) NOT NULL DEFAULT '';

ALTER TABLE "skills"
  ADD COLUMN IF NOT EXISTS "skill_source" varchar(32) NOT NULL DEFAULT '';

ALTER TABLE "skills"
  DROP CONSTRAINT IF EXISTS "skills_pkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'skills'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "skills"
      ADD CONSTRAINT "skills_pk"
      PRIMARY KEY ("skill_name", "plugin_name", "marketplace_name", "skill_source");
  END IF;
END $$;
