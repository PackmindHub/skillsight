ALTER TABLE "marketplace_sources" ADD COLUMN IF NOT EXISTS "import_plugins_and_skills" boolean NOT NULL DEFAULT false;
