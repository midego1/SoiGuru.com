CREATE TABLE "soiguru_places_usage" (
	"month" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "soiguru_places_usage_month_sku_pk" PRIMARY KEY("month","sku")
);
--> statement-breakpoint
-- October 2026: Google photos ran for two days before this counter existed. Start the month at a
-- safe estimate of that use so the free allowance (1,000 photos, 5,000 searches) is not passed.
INSERT INTO "soiguru_places_usage" ("month", "sku", "count") VALUES ('2026-10', 'photo', 500), ('2026-10', 'search', 1000) ON CONFLICT DO NOTHING;
