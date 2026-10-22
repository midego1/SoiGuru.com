CREATE TABLE "soiguru_claim_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"city" text NOT NULL,
	"listing_slug" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soiguru_claim_photos" ADD CONSTRAINT "soiguru_claim_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "soiguru_claim_photos_slot_idx" ON "soiguru_claim_photos" USING btree ("user_id","city","listing_slug","kind");