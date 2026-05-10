CREATE TABLE IF NOT EXISTS "marketplace_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"git_url" varchar(1000) NOT NULL,
	"access_token_encrypted" text,
	"branch" varchar(255),
	"marketplace_name" varchar(255),
	"sync_interval_ms" integer NOT NULL DEFAULT 3600000,
	"enabled" boolean NOT NULL DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
