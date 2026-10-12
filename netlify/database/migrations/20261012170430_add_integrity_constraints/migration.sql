CREATE UNIQUE INDEX "pets_id_owner_idx" ON "pets" ("id","owner_id");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "tasks_pet_owner_fk" FOREIGN KEY ("pet_id","owner_id") REFERENCES "pets"("id","owner_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_kind_check" CHECK ("kind" in ('article', 'product', 'place', 'event'));--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_status_check" CHECK ("status" in ('draft', 'pending', 'published', 'rejected', 'corrections', 'archived'));--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_price_check" CHECK ("price_cents" is null or ("price_cents" >= 0 and "price_verified_at" is not null));--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_event_date_check" CHECK ("kind" <> 'event' or "event_at" is not null);--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_species_check" CHECK ("species" in ('dog', 'cat'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_trial_dates_check" CHECK ("trial_end" >= "trial_start");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_trial_check" CHECK ("trial_days" between 1 and 365);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_price_check" CHECK ("price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_billing_disabled_check" CHECK ("billing_enabled" = false);--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "supplier_status_check" CHECK ("status" in ('pending', 'review', 'approved', 'rejected', 'corrections', 'suspended'));