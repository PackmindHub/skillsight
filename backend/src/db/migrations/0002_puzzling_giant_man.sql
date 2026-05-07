CREATE TABLE IF NOT EXISTS "marketplaces" (
	"name" varchar(255) PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'to_review' NOT NULL,
	"url" varchar(1000),
	"description" text,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source" varchar(20) DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_integration_id" uuid;