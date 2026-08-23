CREATE TYPE "public"."actor_type" AS ENUM('citizen', 'officer', 'system', 'agent');--> statement-breakpoint
CREATE TYPE "public"."appeal_status" AS ENUM('filed', 'under_review', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attachment_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."grievance_event_type" AS ENUM('created', 'submitted', 'status_changed', 'message', 'clarification_requested', 'clarification_replied', 'feedback_received', 'appeal_filed', 'appeal_resolved', 'publication_changed');--> statement-breakpoint
CREATE TYPE "public"."grievance_status" AS ENUM('draft', 'submitted', 'acknowledged', 'routed', 'in_review', 'needs_information', 'action_taken', 'resolved', 'appealed', 'appeal_resolved', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('union_ministry', 'central_department', 'state', 'state_department', 'subordinate_office');--> statement-breakpoint
CREATE TYPE "public"."publication_consent" AS ENUM('not_set', 'opted_in', 'opted_out');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"thread_key" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appeal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "appeal_status" DEFAULT 'filed' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"grievance_id" uuid,
	"draft_id" uuid,
	"pathname" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text NOT NULL,
	"status" "attachment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_size_positive_chk" CHECK ("attachment"."size_bytes" > 0),
	CONSTRAINT "attachment_single_owner_target_chk" CHECK (("attachment"."draft_id" is null) <> ("attachment"."grievance_id" is null))
);
--> statement-breakpoint
CREATE TABLE "category_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ancestry" text[] NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_node_org_parent_slug_uidx" UNIQUE NULLS NOT DISTINCT("organization_id","parent_category_id","slug")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_score_range_chk" CHECK ("feedback"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "form_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_key" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_node_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema" jsonb NOT NULL,
	"source_path" text NOT NULL,
	"checksum" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" text NOT NULL,
	"user_id" text NOT NULL,
	"draft_id" uuid,
	"organization_id" uuid NOT NULL,
	"category_node_id" uuid NOT NULL,
	"form_definition_id" uuid NOT NULL,
	"status" "grievance_status" DEFAULT 'submitted' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remarks" text NOT NULL,
	"review_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"public_consent" "publication_consent" DEFAULT 'not_set' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grievance_registration_id_unique" UNIQUE("registration_id")
);
--> statement-breakpoint
CREATE TABLE "grievance_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"form_definition_id" uuid,
	"language" text DEFAULT 'en' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remarks" text,
	"attachment_metadata" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence" numeric(5, 4),
	"review_hash" text,
	"public_consent" "publication_consent" DEFAULT 'not_set' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grievance_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"event_type" "grievance_event_type" NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" text,
	"from_status" "grievance_status",
	"to_status" "grievance_status",
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_organization_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"jurisdiction" text NOT NULL,
	"source" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "performance_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"raw_metrics" jsonb NOT NULL,
	"composite_score" numeric(7, 4) NOT NULL,
	"grade" text NOT NULL,
	"sample_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "performance_snapshot_window_chk" CHECK ("performance_snapshot"."window_end" > "performance_snapshot"."window_start")
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "public_grievance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"summary" text NOT NULL,
	"category_path" text[] NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "grievance_status" NOT NULL,
	"broad_location" text,
	"synthetic" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_grievance_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_thread" ADD CONSTRAINT "agent_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_draft_id_grievance_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."grievance_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_node" ADD CONSTRAINT "category_node_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_node" ADD CONSTRAINT "category_node_parent_category_id_category_node_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."category_node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_definition" ADD CONSTRAINT "form_definition_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_definition" ADD CONSTRAINT "form_definition_category_node_id_category_node_id_fk" FOREIGN KEY ("category_node_id") REFERENCES "public"."category_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_draft_id_grievance_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."grievance_draft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_category_node_id_category_node_id_fk" FOREIGN KEY ("category_node_id") REFERENCES "public"."category_node"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance" ADD CONSTRAINT "grievance_form_definition_id_form_definition_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definition"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_draft" ADD CONSTRAINT "grievance_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_draft" ADD CONSTRAINT "grievance_draft_form_definition_id_form_definition_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_event" ADD CONSTRAINT "grievance_event_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grievance_event" ADD CONSTRAINT "grievance_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_parent_organization_id_organization_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_snapshot" ADD CONSTRAINT "performance_snapshot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_grievance" ADD CONSTRAINT "public_grievance_grievance_id_grievance_id_fk" FOREIGN KEY ("grievance_id") REFERENCES "public"."grievance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_grievance" ADD CONSTRAINT "public_grievance_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_thread_user_key_uidx" ON "agent_thread" USING btree ("user_id","thread_key");--> statement-breakpoint
CREATE INDEX "agent_thread_user_updated_idx" ON "agent_thread" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appeal_grievance_uidx" ON "appeal" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "appeal_user_created_idx" ON "appeal" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_owner_path_uidx" ON "attachment" USING btree ("owner_user_id","pathname");--> statement-breakpoint
CREATE INDEX "attachment_grievance_owner_idx" ON "attachment" USING btree ("grievance_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "attachment_draft_owner_idx" ON "attachment" USING btree ("draft_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "category_node_org_parent_idx" ON "category_node" USING btree ("organization_id","parent_category_id");--> statement-breakpoint
CREATE INDEX "category_node_ancestry_idx" ON "category_node" USING gin ("ancestry");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_grievance_uidx" ON "feedback" USING btree ("grievance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_definition_key_version_uidx" ON "form_definition" USING btree ("form_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "form_definition_checksum_uidx" ON "form_definition" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "form_definition_org_category_idx" ON "form_definition" USING btree ("organization_id","category_node_id","active");--> statement-breakpoint
CREATE INDEX "form_definition_checksum_idx" ON "form_definition" USING btree ("checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "grievance_user_idempotency_uidx" ON "grievance" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "grievance_user_status_submitted_idx" ON "grievance" USING btree ("user_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "grievance_org_status_idx" ON "grievance" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "grievance_draft_user_updated_idx" ON "grievance_draft" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "grievance_event_timeline_idx" ON "grievance_event" USING btree ("grievance_id","created_at");--> statement-breakpoint
CREATE INDEX "grievance_event_actor_idx" ON "grievance_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_parent_idx" ON "organization" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "organization_hierarchy_idx" ON "organization" USING btree ("type","jurisdiction","active");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_snapshot_org_window_uidx" ON "performance_snapshot" USING btree ("organization_id","window_start","window_end");--> statement-breakpoint
CREATE INDEX "performance_snapshot_window_idx" ON "performance_snapshot" USING btree ("window_start","window_end","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_grievance_grievance_uidx" ON "public_grievance" USING btree ("grievance_id");--> statement-breakpoint
CREATE INDEX "public_grievance_pagination_idx" ON "public_grievance" USING btree ("published_at","id");--> statement-breakpoint
CREATE INDEX "public_grievance_org_status_idx" ON "public_grievance" USING btree ("organization_id","status","published_at");--> statement-breakpoint
CREATE INDEX "role_permission_permission_idx" ON "role_permission" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_user_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");