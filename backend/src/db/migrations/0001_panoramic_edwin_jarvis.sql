CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) DEFAULT 'loki' NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"auth_type" varchar(20) DEFAULT 'none' NOT NULL,
	"auth_username" varchar(255),
	"auth_password_encrypted" text,
	"loki_query" varchar(500) DEFAULT '{job="claude-code"}' NOT NULL,
	"sync_interval_ms" integer DEFAULT 30000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
