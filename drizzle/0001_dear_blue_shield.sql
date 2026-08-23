CREATE TYPE "public"."closure_reason" AS ENUM('citizen_confirmed', 'department_action_unconfirmed', 'citizen_did_not_provide_information', 'withdrawn_by_citizen', 'appeal_decided', 'duplicate_merged', 'not_admissible');--> statement-breakpoint
ALTER TABLE "grievance" ADD COLUMN "closure_reason" "closure_reason";--> statement-breakpoint
ALTER TABLE "grievance" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "grievance" ADD COLUMN "closure_note" text;--> statement-breakpoint
ALTER TABLE "grievance" ADD COLUMN "citizen_response_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "grievance" ADD COLUMN "appeal_eligible_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "grievance_org_closure_idx" ON "grievance" USING btree ("organization_id","closure_reason","closed_at");--> statement-breakpoint
CREATE INDEX "grievance_response_due_idx" ON "grievance" USING btree ("status","citizen_response_due_at");--> statement-breakpoint
CREATE INDEX "grievance_appeal_eligible_idx" ON "grievance" USING btree ("user_id","appeal_eligible_until");--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_closure_pair_chk" CHECK (("grievance"."closure_reason" is null) = ("grievance"."closed_at" is null));--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_appeal_deadline_chk" CHECK ("grievance"."appeal_eligible_until" is null or "grievance"."closed_at" is null or "grievance"."appeal_eligible_until" >= "grievance"."closed_at");