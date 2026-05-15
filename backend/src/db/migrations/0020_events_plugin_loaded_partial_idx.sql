CREATE INDEX IF NOT EXISTS "events_plugin_loaded_partial_idx" ON "events" ((attributes->>'plugin.name'), "timestamp") WHERE "event_name" = 'claude_code.plugin_loaded';
