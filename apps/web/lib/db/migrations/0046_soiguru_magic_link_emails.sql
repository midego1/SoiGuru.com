CREATE TABLE "soiguru_email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"preheader" text DEFAULT '' NOT NULL,
	"body_html" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soiguru_magic_links" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"request_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soiguru_email_templates" ADD CONSTRAINT "soiguru_email_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "soiguru_magic_links_token_hash_idx" ON "soiguru_magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "soiguru_magic_links_email_created_idx" ON "soiguru_magic_links" USING btree ("email","created_at");