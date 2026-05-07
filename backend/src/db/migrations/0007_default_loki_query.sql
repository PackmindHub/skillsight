ALTER TABLE "integrations" ALTER COLUMN "loki_query" SET DEFAULT '{service_name="claude-code"} | event_name=~`skill_activated|plugin_installed`';
