-- Hand-authored: drizzle-kit migrate:generate is blocked by interactive rename-
-- detection prompts in this repo (snapshot drift since 0002 — see 0021 header).
--
-- Widens external_skill_plugin_mappings identity from a single-column skill_name
-- primary key to the composite (skill_name, plugin_name, marketplace_name) so the
-- same skill can legitimately belong to several plugins. The single-column PK made
-- any one sync batch that carried a skill twice (e.g. the same skill declared in
-- two Packmind packages) fail at runtime with:
--   "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- because INSERT ... ON CONFLICT ("skill_name") cannot touch the same conflict key
-- twice in one statement.
--
-- Existing data is unaffected: the old PK made skill_name unique, so every row is
-- already unique under the wider composite key. All statements are idempotent —
-- safe to re-run on a partially-applied DB.

ALTER TABLE "external_skill_plugin_mappings"
  DROP CONSTRAINT IF EXISTS "external_skill_plugin_mappings_pkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'external_skill_plugin_mappings'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE "external_skill_plugin_mappings"
      ADD CONSTRAINT "external_skill_plugin_mappings_pk"
      PRIMARY KEY ("skill_name", "plugin_name", "marketplace_name");
  END IF;
END $$;
