CREATE TABLE "public_grievance_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_grievance_id" uuid NOT NULL,
	"source_event_id" uuid NOT NULL,
	"status" "grievance_status" NOT NULL,
	"label" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_preview" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"summary" text NOT NULL,
	"category_path" text[] NOT NULL,
	"organization_id" uuid NOT NULL,
	"broad_location" text,
	"source_review_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"redaction_version" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_grievance_event" ADD CONSTRAINT "public_grievance_event_public_grievance_id_public_grievance_id_fk" FOREIGN KEY ("public_grievance_id") REFERENCES "public"."public_grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_grievance_event" ADD CONSTRAINT "public_grievance_event_source_event_id_grievance_event_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."grievance_event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_preview" ADD CONSTRAINT "publication_preview_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_preview" ADD CONSTRAINT "publication_preview_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_preview" ADD CONSTRAINT "publication_preview_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_grievance_event_source_uidx" ON "public_grievance_event" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "public_grievance_event_timeline_idx" ON "public_grievance_event" USING btree ("public_grievance_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_preview_grievance_uidx" ON "publication_preview" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "publication_preview_user_expiry_idx" ON "publication_preview" USING btree ("user_id","expires_at");