CREATE TYPE "public"."accountability_source_kind" AS ENUM('synthetic', 'official', 'imported');--> statement-breakpoint
CREATE TYPE "public"."appeal_decision_outcome" AS ENUM('original_decision_upheld', 'original_decision_modified', 'original_decision_overturned');--> statement-breakpoint
CREATE TYPE "public"."citizen_resolution_assessment" AS ENUM('resolved', 'partially_resolved', 'not_resolved');--> statement-breakpoint
CREATE TABLE "accountability_metric_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_node_id" uuid,
	"metric_key" text NOT NULL,
	"metric_version" text NOT NULL,
	"window_days" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"value" numeric(14, 4) NOT NULL,
	"sample_size" integer NOT NULL,
	"numerator" integer,
	"denominator" integer,
	"eligible" boolean NOT NULL,
	"supporting_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_kind" "accountability_source_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accountability_metric_snapshot_scope_uidx" UNIQUE NULLS NOT DISTINCT("organization_id","category_node_id","metric_key","metric_version","window_days","window_start","window_end"),
	CONSTRAINT "accountability_metric_window_chk" CHECK ("accountability_metric_snapshot"."window_end" > "accountability_metric_snapshot"."window_start" and "accountability_metric_snapshot"."window_days" > 0),
	CONSTRAINT "accountability_metric_sample_chk" CHECK ("accountability_metric_snapshot"."sample_size" >= 0 and ("accountability_metric_snapshot"."numerator" is null or "accountability_metric_snapshot"."numerator" >= 0) and ("accountability_metric_snapshot"."denominator" is null or "accountability_metric_snapshot"."denominator" >= 0))
);
--> statement-breakpoint
ALTER TABLE "performance_snapshot" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "performance_snapshot" CASCADE;--> statement-breakpoint
ALTER TABLE "appeal" ADD COLUMN "decision_outcome" "appeal_decision_outcome";--> statement-breakpoint
ALTER TABLE "appeal" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "resolution_assessment" "citizen_resolution_assessment";--> statement-breakpoint
UPDATE "feedback"
SET "resolution_assessment" = CASE
	WHEN "score" <= 2 THEN 'not_resolved'::"citizen_resolution_assessment"
	WHEN "score" = 3 THEN 'partially_resolved'::"citizen_resolution_assessment"
	ELSE 'resolved'::"citizen_resolution_assessment"
END;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "resolution_assessment" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accountability_metric_snapshot" ADD CONSTRAINT "accountability_metric_snapshot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountability_metric_snapshot" ADD CONSTRAINT "accountability_metric_snapshot_category_node_id_category_node_id_fk" FOREIGN KEY ("category_node_id") REFERENCES "public"."category_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accountability_metric_ranking_idx" ON "accountability_metric_snapshot" USING btree ("metric_key","window_days","window_end","eligible","value","organization_id");--> statement-breakpoint
CREATE INDEX "accountability_metric_org_trend_idx" ON "accountability_metric_snapshot" USING btree ("organization_id","metric_key","window_days","window_end");--> statement-breakpoint
CREATE INDEX "accountability_metric_category_idx" ON "accountability_metric_snapshot" USING btree ("category_node_id","metric_key","window_end");--> statement-breakpoint
CREATE INDEX "appeal_outcome_resolved_idx" ON "appeal" USING btree ("decision_outcome","resolved_at");--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_decision_pair_chk" CHECK (("appeal"."decision_outcome" is null) = ("appeal"."resolved_at" is null));--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_decision_status_chk" CHECK ("appeal"."decision_outcome" is null or "appeal"."status" = 'resolved');
