CREATE TYPE "public"."cron_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" "cron_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "cron_runs_job_started_idx" ON "cron_runs" USING btree ("job","started_at");