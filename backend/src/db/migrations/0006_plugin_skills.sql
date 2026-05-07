CREATE TABLE IF NOT EXISTS "plugin_skills" (
  "plugin_name" varchar(255) NOT NULL REFERENCES "plugins"("plugin_name"),
  "skill_name"  varchar(255) NOT NULL,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at"  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "plugin_skills_pkey" PRIMARY KEY ("plugin_name", "skill_name")
);

ALTER TABLE "marketplace_sources"
  ADD COLUMN IF NOT EXISTS "import_plugins_and_skills" boolean NOT NULL DEFAULT false;
