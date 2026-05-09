CREATE TABLE IF NOT EXISTS "skills" (
  "skill_name"    varchar(255) NOT NULL,
  "plugin_name"   varchar(255) NOT NULL DEFAULT '',
  "status"        varchar(20)  NOT NULL DEFAULT 'unknown',
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at"  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "skills_pkey" PRIMARY KEY ("skill_name", "plugin_name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_status_idx" ON "skills" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_plugin_name_idx" ON "skills" USING btree ("plugin_name");
--> statement-breakpoint
INSERT INTO "skills" ("skill_name", "plugin_name", "status")
SELECT skill_name, plugin_name, 'unknown'
FROM "plugin_skills"
ON CONFLICT ("skill_name", "plugin_name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "skills" ("skill_name", "plugin_name", "status")
SELECT DISTINCT attributes->>'skill.name', '', 'unknown'
FROM "events"
WHERE event_name = 'claude_code.skill_activated'
  AND attributes->>'skill.name' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "plugin_skills" ps
    WHERE ps.skill_name = events.attributes->>'skill.name'
  )
ON CONFLICT ("skill_name", "plugin_name") DO NOTHING;
--> statement-breakpoint
UPDATE "skills" s SET "status" = 'removed'
FROM "plugin_skills" ps
JOIN "plugins" p ON p.plugin_name = ps.plugin_name
WHERE ps.skill_name = s.skill_name
  AND ps.plugin_name = s.plugin_name
  AND p.status = 'removed';
