CREATE TABLE "listing_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"city" text NOT NULL,
	"listing_slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification" text DEFAULT 'call' NOT NULL,
	"contact_phone" text,
	"note" text,
	"plan" text DEFAULT 'yearly' NOT NULL,
	"payment_method" text DEFAULT 'promptpay' NOT NULL,
	"paid_at" timestamp,
	"paid_until" timestamp,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "listing_claims" ADD CONSTRAINT "listing_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_claims" ADD CONSTRAINT "listing_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_claims_user_id_idx" ON "listing_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listing_claims_listing_idx" ON "listing_claims" USING btree ("city","listing_slug");--> statement-breakpoint
CREATE INDEX "listing_claims_status_idx" ON "listing_claims" USING btree ("status");
