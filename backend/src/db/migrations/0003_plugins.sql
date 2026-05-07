CREATE TABLE IF NOT EXISTS "plugins" (
  "plugin_name"             varchar(255) PRIMARY KEY,
  "marketplace_name"        varchar(255),
  "plugin_version"          varchar(100),
  "install_trigger"         varchar(20),
  "marketplace_is_official" boolean,
  "status"                  varchar(20) NOT NULL DEFAULT 'unknown',
  "first_seen_at"           timestamp NOT NULL DEFAULT now(),
  "last_seen_at"            timestamp NOT NULL DEFAULT now()
);
