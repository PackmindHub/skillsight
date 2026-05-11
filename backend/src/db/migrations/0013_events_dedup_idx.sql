-- Dedupe before adding the unique index. The Loki sync scheduler can pull the
-- same log line twice when its time window overlaps a previous run, producing
-- exact-duplicate rows that block the unique index from being created.
-- Match the index's NULL-distinct semantics (plain =, not IS NOT DISTINCT FROM)
-- so we only collapse rows the index would actually consider duplicates.
DELETE FROM "events" e
USING "events" d
WHERE e.id > d.id
  AND e."timestamp" = d."timestamp"
  AND e."event_name" = d."event_name"
  AND e."user_email" = d."user_email"
  AND e."session_id" = d."session_id";

CREATE UNIQUE INDEX IF NOT EXISTS "events_dedup_idx"
  ON "events" ("timestamp", "user_email", "session_id", "event_name");
