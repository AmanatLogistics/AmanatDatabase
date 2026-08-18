ALTER TABLE "staff" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "last_signed_in_at" timestamp with time zone;