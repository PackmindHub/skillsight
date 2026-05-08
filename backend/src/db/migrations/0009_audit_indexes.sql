CREATE INDEX IF NOT EXISTS "audit_events_timestamp_idx" ON "audit_events" USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS "audit_events_action_ts_idx" ON "audit_events" USING btree ("action", "timestamp");
CREATE INDEX IF NOT EXISTS "audit_events_actor_ts_idx" ON "audit_events" USING btree ("actor_email", "timestamp");
