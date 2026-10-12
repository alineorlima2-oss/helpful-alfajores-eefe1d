CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"species" text DEFAULT 'all' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"image" text,
	"url" text,
	"link_type" text DEFAULT 'official' NOT NULL,
	"price_cents" integer,
	"price_verified_at" timestamp with time zone,
	"event_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"author" text DEFAULT 'Curadoria Muvpet' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"content_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY,
	"owner_id" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"breed" text DEFAULT '' NOT NULL,
	"birth_date" text,
	"weight" text,
	"notes" text DEFAULT '' NOT NULL,
	"photo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"communications" boolean DEFAULT false NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"trial_start" timestamp with time zone NOT NULL,
	"trial_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY,
	"trial_days" integer DEFAULT 30 NOT NULL,
	"price_cents" integer DEFAULT 590 NOT NULL,
	"billing_period" text DEFAULT 'undefined' NOT NULL,
	"billing_enabled" boolean DEFAULT false NOT NULL,
	"welcome_text" text DEFAULT 'Uma vida mais feliz, juntos.' NOT NULL,
	"support_email" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY,
	"business_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"website" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"terms_accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "content_public_idx" ON "content" ("status","kind");--> statement-breakpoint
CREATE INDEX "content_owner_idx" ON "content" ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_owner_content_idx" ON "favorites" ("owner_id","content_id");--> statement-breakpoint
CREATE INDEX "pets_owner_idx" ON "pets" ("owner_id");--> statement-breakpoint
CREATE INDEX "tasks_owner_due_idx" ON "care_tasks" ("owner_id","due_at");--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_content_id_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_id_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_pet_id_pets_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE;