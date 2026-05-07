CREATE TABLE IF NOT EXISTS "marketplaces" (
  "name" varchar(255) PRIMARY KEY,
  "status" varchar(20) NOT NULL DEFAULT 'to_review',
  "url" varchar(1000),
  "description" text,
  "first_seen_at" timestamp NOT NULL DEFAULT now(),
  "last_seen_at" timestamp NOT NULL DEFAULT now()
);
