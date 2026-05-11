-- Switch the default LogQL query from a structured-metadata filter
-- (`| event_name=~`...`) to a log-line regex (`|~ "..."`). Loki's native OTLP
-- receiver stores the event name as the log-line body and the OTLP record
-- attributes as structured metadata under different keys (e.g. `event_name`
-- only exists when the producer set it explicitly), so the previous default
-- silently matched zero rows on Grafana-Cloud-style ingestion paths.
ALTER TABLE "integrations" ALTER COLUMN "loki_query" SET DEFAULT '{service_name="claude-code"} |~ "skill_activated|plugin_installed"';

-- Best-effort: update any rows that still hold the previous default verbatim,
-- so existing integrations created with the old default get the working query.
-- Customized queries are left untouched.
UPDATE "integrations"
SET "loki_query" = '{service_name="claude-code"} |~ "skill_activated|plugin_installed"'
WHERE "loki_query" = '{service_name="claude-code"} | event_name=~`skill_activated|plugin_installed`';
