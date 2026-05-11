CREATE UNIQUE INDEX IF NOT EXISTS "events_dedup_idx"
  ON "events" ("timestamp", "user_email", "session_id", "event_name");
