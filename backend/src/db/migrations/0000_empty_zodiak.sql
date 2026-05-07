CREATE TABLE "allowed_skills" (
	"skill_name" varchar(255) PRIMARY KEY NOT NULL,
	"source" varchar(100),
	"added_at" timestamp DEFAULT now() NOT NULL,
	"added_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_email" varchar(255),
	"action" varchar(100) NOT NULL,
	"target" varchar(500),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_email" varchar(255),
	"session_id" varchar(255),
	"event_name" varchar(255) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"attributes" jsonb
);
--> statement-breakpoint
CREATE TABLE "revoked_tokens" (
	"jti" varchar(36) PRIMARY KEY NOT NULL,
	"revoked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jti" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"user_label" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "tokens_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(50) DEFAULT 'admin' NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "events_event_name_ts_idx" ON "events" USING btree ("event_name","timestamp");--> statement-breakpoint
CREATE INDEX "events_session_id_idx" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "events_user_email_ts_idx" ON "events" USING btree ("user_email","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_skill_name_partial_idx" ON "events" ((attributes->>'skill.name'), "timestamp") WHERE "event_name" = 'claude_code.skill_activated';