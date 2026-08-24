ALTER TABLE "attachment" ADD COLUMN "original_name" text;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "field_id" text;--> statement-breakpoint
UPDATE "attachment"
SET
	"original_name" = COALESCE(NULLIF(regexp_replace("pathname", '^.*/', ''), ''), 'attachment'),
	"field_id" = '__legacy_attachment__'
WHERE "original_name" IS NULL OR "field_id" IS NULL;--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "original_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ALTER COLUMN "field_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_draft_uidx" ON "attachment" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_grievance_uidx" ON "attachment" USING btree ("grievance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grievance_draft_uidx" ON "grievance" USING btree ("draft_id");
