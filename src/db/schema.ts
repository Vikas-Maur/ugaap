import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

// Better Auth tables. Keep these names and columns compatible with the Drizzle
// adapter; domain records reference user.id rather than copying identity data.
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		issuer: text("issuer").notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("account_issuer_accountId_uidx").on(
			table.issuer,
			table.accountId,
		),
		index("account_userId_idx").on(table.userId),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const organizationType = pgEnum("organization_type", [
	"union_ministry",
	"central_department",
	"state",
	"state_department",
	"subordinate_office",
]);

export const grievanceStatus = pgEnum("grievance_status", [
	"draft",
	"submitted",
	"acknowledged",
	"routed",
	"in_review",
	"needs_information",
	"action_taken",
	"resolved",
	"appealed",
	"appeal_resolved",
	"withdrawn",
]);

export const publicationConsent = pgEnum("publication_consent", [
	"not_set",
	"opted_in",
	"opted_out",
]);

export const closureReason = pgEnum("closure_reason", [
	"citizen_confirmed",
	"department_action_unconfirmed",
	"citizen_did_not_provide_information",
	"withdrawn_by_citizen",
	"appeal_decided",
	"duplicate_merged",
	"not_admissible",
]);

export const grievanceEventType = pgEnum("grievance_event_type", [
	"created",
	"submitted",
	"status_changed",
	"message",
	"clarification_requested",
	"clarification_replied",
	"feedback_received",
	"appeal_filed",
	"appeal_resolved",
	"publication_changed",
]);

export const actorType = pgEnum("actor_type", [
	"citizen",
	"officer",
	"system",
	"agent",
]);

export const attachmentStatus = pgEnum("attachment_status", [
	"pending",
	"ready",
	"failed",
]);

export const appealStatus = pgEnum("appeal_status", [
	"filed",
	"under_review",
	"resolved",
	"rejected",
]);

export const appealDecisionOutcome = pgEnum("appeal_decision_outcome", [
	"original_decision_upheld",
	"original_decision_modified",
	"original_decision_overturned",
]);

export const citizenResolutionAssessment = pgEnum(
	"citizen_resolution_assessment",
	["resolved", "partially_resolved", "not_resolved"],
);

export const accountabilitySourceKind = pgEnum("accountability_source_kind", [
	"synthetic",
	"official",
	"imported",
]);

export const organization = pgTable(
	"organization",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		parentOrganizationId: uuid("parent_organization_id").references(
			(): AnyPgColumn => organization.id,
			{ onDelete: "set null" },
		),
		slug: text("slug").notNull().unique(),
		name: text("name").notNull(),
		type: organizationType("type").notNull(),
		jurisdiction: text("jurisdiction").notNull(),
		source: text("source").notNull(),
		active: boolean("active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("organization_parent_idx").on(table.parentOrganizationId),
		index("organization_hierarchy_idx").on(
			table.type,
			table.jurisdiction,
			table.active,
		),
	],
);

export const categoryNode = pgTable(
	"category_node",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		parentCategoryId: uuid("parent_category_id").references(
			(): AnyPgColumn => categoryNode.id,
			{ onDelete: "set null" },
		),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		ancestry: text("ancestry").array().notNull(),
		depth: integer("depth").notNull().default(0),
		active: boolean("active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		unique("category_node_org_parent_slug_uidx")
			.on(table.organizationId, table.parentCategoryId, table.slug)
			.nullsNotDistinct(),
		index("category_node_org_parent_idx").on(
			table.organizationId,
			table.parentCategoryId,
		),
		index("category_node_ancestry_idx").using("gin", table.ancestry),
	],
);

export const formDefinition = pgTable(
	"form_definition",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		formKey: text("form_key").notNull(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		categoryNodeId: uuid("category_node_id")
			.notNull()
			.references(() => categoryNode.id, { onDelete: "restrict" }),
		version: integer("version").notNull(),
		schema: jsonb("schema").$type<Record<string, unknown>>().notNull(),
		sourcePath: text("source_path").notNull(),
		checksum: text("checksum").notNull(),
		active: boolean("active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("form_definition_key_version_uidx").on(
			table.formKey,
			table.version,
		),
		uniqueIndex("form_definition_checksum_uidx").on(table.checksum),
		index("form_definition_org_category_idx").on(
			table.organizationId,
			table.categoryNodeId,
			table.active,
		),
		index("form_definition_checksum_idx").on(table.checksum),
	],
);

export const grievanceDraft = pgTable(
	"grievance_draft",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		formDefinitionId: uuid("form_definition_id").references(
			() => formDefinition.id,
			{ onDelete: "set null" },
		),
		language: text("language").notNull().default("en"),
		answers: jsonb("answers")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		remarks: text("remarks"),
		attachmentMetadata: jsonb("attachment_metadata")
			.$type<Array<Record<string, unknown>>>()
			.notNull()
			.default([]),
		aiConfidence: numeric("ai_confidence", { precision: 5, scale: 4 }),
		reviewHash: text("review_hash"),
		publicConsent: publicationConsent("public_consent")
			.default("not_set")
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("grievance_draft_user_updated_idx").on(table.userId, table.updatedAt),
	],
);

export const grievance = pgTable(
	"grievance",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		registrationId: text("registration_id").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		draftId: uuid("draft_id").references(() => grievanceDraft.id, {
			onDelete: "set null",
		}),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		categoryNodeId: uuid("category_node_id")
			.notNull()
			.references(() => categoryNode.id, { onDelete: "restrict" }),
		formDefinitionId: uuid("form_definition_id")
			.notNull()
			.references(() => formDefinition.id, { onDelete: "restrict" }),
		status: grievanceStatus("status").default("submitted").notNull(),
		language: text("language").notNull().default("en"),
		answers: jsonb("answers")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		remarks: text("remarks").notNull(),
		reviewHash: text("review_hash").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		publicConsent: publicationConsent("public_consent")
			.default("not_set")
			.notNull(),
		closureReason: closureReason("closure_reason"),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		closureNote: text("closure_note"),
		citizenResponseDueAt: timestamp("citizen_response_due_at", {
			withTimezone: true,
		}),
		appealEligibleUntil: timestamp("appeal_eligible_until", {
			withTimezone: true,
		}),
		submittedAt: timestamp("submitted_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("grievance_user_idempotency_uidx").on(
			table.userId,
			table.idempotencyKey,
		),
		uniqueIndex("grievance_draft_uidx").on(table.draftId),
		index("grievance_user_status_submitted_idx").on(
			table.userId,
			table.status,
			table.submittedAt,
		),
		index("grievance_org_status_idx").on(table.organizationId, table.status),
		index("grievance_org_closure_idx").on(
			table.organizationId,
			table.closureReason,
			table.closedAt,
		),
		index("grievance_response_due_idx").on(
			table.status,
			table.citizenResponseDueAt,
		),
		index("grievance_appeal_eligible_idx").on(
			table.userId,
			table.appealEligibleUntil,
		),
		check(
			"grievance_closure_pair_chk",
			sql`(${table.closureReason} is null) = (${table.closedAt} is null)`,
		),
		check(
			"grievance_appeal_deadline_chk",
			sql`${table.appealEligibleUntil} is null or ${table.closedAt} is null or ${table.appealEligibleUntil} >= ${table.closedAt}`,
		),
	],
);

export const attachment = pgTable(
	"attachment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		grievanceId: uuid("grievance_id").references(() => grievance.id, {
			onDelete: "cascade",
		}),
		draftId: uuid("draft_id").references(() => grievanceDraft.id, {
			onDelete: "cascade",
		}),
		pathname: text("pathname").notNull(),
		originalName: text("original_name").notNull(),
		fieldId: text("field_id").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
		checksum: text("checksum").notNull(),
		status: attachmentStatus("status").default("pending").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("attachment_owner_path_uidx").on(
			table.ownerUserId,
			table.pathname,
		),
		uniqueIndex("attachment_draft_uidx").on(table.draftId),
		uniqueIndex("attachment_grievance_uidx").on(table.grievanceId),
		index("attachment_grievance_owner_idx").on(
			table.grievanceId,
			table.ownerUserId,
		),
		index("attachment_draft_owner_idx").on(table.draftId, table.ownerUserId),
		check("attachment_size_positive_chk", sql`${table.sizeBytes} > 0`),
		check(
			"attachment_single_owner_target_chk",
			sql`(${table.draftId} is null) <> (${table.grievanceId} is null)`,
		),
	],
);

export const grievanceEvent = pgTable(
	"grievance_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		grievanceId: uuid("grievance_id")
			.notNull()
			.references(() => grievance.id, { onDelete: "cascade" }),
		eventType: grievanceEventType("event_type").notNull(),
		actorType: actorType("actor_type").notNull(),
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		fromStatus: grievanceStatus("from_status"),
		toStatus: grievanceStatus("to_status"),
		message: text("message"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("grievance_event_timeline_idx").on(
			table.grievanceId,
			table.createdAt,
		),
		index("grievance_event_actor_idx").on(table.actorUserId, table.createdAt),
	],
);

export const feedback = pgTable(
	"feedback",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		grievanceId: uuid("grievance_id")
			.notNull()
			.references(() => grievance.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		score: integer("score").notNull(),
		resolutionAssessment: citizenResolutionAssessment(
			"resolution_assessment",
		).notNull(),
		comment: text("comment"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("feedback_grievance_uidx").on(table.grievanceId),
		check("feedback_score_range_chk", sql`${table.score} between 1 and 5`),
	],
);

export const appeal = pgTable(
	"appeal",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		grievanceId: uuid("grievance_id")
			.notNull()
			.references(() => grievance.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		reason: text("reason").notNull(),
		status: appealStatus("status").default("filed").notNull(),
		decisionOutcome: appealDecisionOutcome("decision_outcome"),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolution: text("resolution"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("appeal_grievance_uidx").on(table.grievanceId),
		index("appeal_user_created_idx").on(table.userId, table.createdAt),
		index("appeal_outcome_resolved_idx").on(
			table.decisionOutcome,
			table.resolvedAt,
		),
		check(
			"appeal_decision_pair_chk",
			sql`(${table.decisionOutcome} is null) = (${table.resolvedAt} is null)`,
		),
		check(
			"appeal_decision_status_chk",
			sql`${table.decisionOutcome} is null or ${table.status} = 'resolved'`,
		),
	],
);

export const publicGrievance = pgTable(
	"public_grievance",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		grievanceId: uuid("grievance_id")
			.notNull()
			.references(() => grievance.id, { onDelete: "cascade" }),
		publicId: text("public_id").notNull().unique(),
		summary: text("summary").notNull(),
		categoryPath: text("category_path").array().notNull(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		status: grievanceStatus("status").notNull(),
		broadLocation: text("broad_location"),
		synthetic: boolean("synthetic").default(true).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("public_grievance_grievance_uidx").on(table.grievanceId),
		index("public_grievance_pagination_idx").on(table.publishedAt, table.id),
		index("public_grievance_org_status_idx").on(
			table.organizationId,
			table.status,
			table.publishedAt,
		),
	],
);

export const publicationPreview = pgTable(
	"publication_preview",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		grievanceId: uuid("grievance_id")
			.notNull()
			.references(() => grievance.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		summary: text("summary").notNull(),
		categoryPath: text("category_path").array().notNull(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		broadLocation: text("broad_location"),
		sourceReviewHash: text("source_review_hash").notNull(),
		contentHash: text("content_hash").notNull(),
		redactionVersion: text("redaction_version").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("publication_preview_grievance_uidx").on(table.grievanceId),
		index("publication_preview_user_expiry_idx").on(
			table.userId,
			table.expiresAt,
		),
	],
);

export const publicGrievanceEvent = pgTable(
	"public_grievance_event",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		publicGrievanceId: uuid("public_grievance_id")
			.notNull()
			.references(() => publicGrievance.id, { onDelete: "cascade" }),
		sourceEventId: uuid("source_event_id")
			.notNull()
			.references(() => grievanceEvent.id, { onDelete: "restrict" }),
		status: grievanceStatus("status").notNull(),
		label: text("label").notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("public_grievance_event_source_uidx").on(table.sourceEventId),
		index("public_grievance_event_timeline_idx").on(
			table.publicGrievanceId,
			table.occurredAt,
			table.id,
		),
	],
);

export const accountabilityMetricSnapshot = pgTable(
	"accountability_metric_snapshot",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		categoryNodeId: uuid("category_node_id").references(() => categoryNode.id, {
			onDelete: "cascade",
		}),
		metricKey: text("metric_key").notNull(),
		metricVersion: text("metric_version").notNull(),
		windowDays: integer("window_days").notNull(),
		windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
		windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
		value: numeric("value", {
			precision: 14,
			scale: 4,
		}).notNull(),
		sampleSize: integer("sample_size").notNull(),
		numerator: integer("numerator"),
		denominator: integer("denominator"),
		eligible: boolean("eligible").notNull(),
		supportingMetrics: jsonb("supporting_metrics")
			.$type<Record<string, number | null>>()
			.notNull()
			.default({}),
		sourceKind: accountabilitySourceKind("source_kind").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		unique("accountability_metric_snapshot_scope_uidx")
			.on(
				table.organizationId,
				table.categoryNodeId,
				table.metricKey,
				table.metricVersion,
				table.windowDays,
				table.windowStart,
				table.windowEnd,
			)
			.nullsNotDistinct(),
		index("accountability_metric_ranking_idx").on(
			table.metricKey,
			table.windowDays,
			table.windowEnd,
			table.eligible,
			table.value,
			table.organizationId,
		),
		index("accountability_metric_org_trend_idx").on(
			table.organizationId,
			table.metricKey,
			table.windowDays,
			table.windowEnd,
		),
		index("accountability_metric_category_idx").on(
			table.categoryNodeId,
			table.metricKey,
			table.windowEnd,
		),
		check(
			"accountability_metric_window_chk",
			sql`${table.windowEnd} > ${table.windowStart} and ${table.windowDays} > 0`,
		),
		check(
			"accountability_metric_sample_chk",
			sql`${table.sampleSize} >= 0 and (${table.numerator} is null or ${table.numerator} >= 0) and (${table.denominator} is null or ${table.denominator} >= 0)`,
		),
	],
);

export const agentThread = pgTable(
	"agent_thread",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		threadKey: text("thread_key").notNull(),
		language: text("language").notNull().default("en"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("agent_thread_user_key_uidx").on(table.userId, table.threadKey),
		index("agent_thread_user_updated_idx").on(table.userId, table.updatedAt),
	],
);

export const role = pgTable("role", {
	id: uuid("id").defaultRandom().primaryKey(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const permission = pgTable("permission", {
	id: uuid("id").defaultRandom().primaryKey(),
	key: text("key").notNull().unique(),
	description: text("description").notNull(),
	active: boolean("active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const userRole = pgTable(
	"user_role",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		roleId: uuid("role_id")
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.roleId] }),
		index("user_role_user_idx").on(table.userId),
	],
);

export const rolePermission = pgTable(
	"role_permission",
	{
		roleId: uuid("role_id")
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		permissionId: uuid("permission_id")
			.notNull()
			.references(() => permission.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.roleId, table.permissionId] }),
		index("role_permission_permission_idx").on(table.permissionId),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	drafts: many(grievanceDraft),
	grievances: many(grievance),
	attachments: many(attachment),
	events: many(grievanceEvent),
	feedback: many(feedback),
	appeals: many(appeal),
	publicationPreviews: many(publicationPreview),
	threads: many(agentThread),
	roles: many(userRole),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const organizationRelations = relations(
	organization,
	({ one, many }) => ({
		parent: one(organization, {
			fields: [organization.parentOrganizationId],
			references: [organization.id],
			relationName: "organization_hierarchy",
		}),
		children: many(organization, { relationName: "organization_hierarchy" }),
		categories: many(categoryNode),
		forms: many(formDefinition),
		grievances: many(grievance),
		publicGrievances: many(publicGrievance),
		publicationPreviews: many(publicationPreview),
		accountabilitySnapshots: many(accountabilityMetricSnapshot),
	}),
);

export const categoryNodeRelations = relations(
	categoryNode,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [categoryNode.organizationId],
			references: [organization.id],
		}),
		parent: one(categoryNode, {
			fields: [categoryNode.parentCategoryId],
			references: [categoryNode.id],
			relationName: "category_ancestry",
		}),
		children: many(categoryNode, { relationName: "category_ancestry" }),
		forms: many(formDefinition),
		accountabilitySnapshots: many(accountabilityMetricSnapshot),
	}),
);

export const accountabilityMetricSnapshotRelations = relations(
	accountabilityMetricSnapshot,
	({ one }) => ({
		organization: one(organization, {
			fields: [accountabilityMetricSnapshot.organizationId],
			references: [organization.id],
		}),
		category: one(categoryNode, {
			fields: [accountabilityMetricSnapshot.categoryNodeId],
			references: [categoryNode.id],
		}),
	}),
);

export const formDefinitionRelations = relations(
	formDefinition,
	({ one, many }) => ({
		organization: one(organization, {
			fields: [formDefinition.organizationId],
			references: [organization.id],
		}),
		category: one(categoryNode, {
			fields: [formDefinition.categoryNodeId],
			references: [categoryNode.id],
		}),
		drafts: many(grievanceDraft),
		grievances: many(grievance),
	}),
);

export const grievanceRelations = relations(grievance, ({ one, many }) => ({
	user: one(user, { fields: [grievance.userId], references: [user.id] }),
	draft: one(grievanceDraft, {
		fields: [grievance.draftId],
		references: [grievanceDraft.id],
	}),
	organization: one(organization, {
		fields: [grievance.organizationId],
		references: [organization.id],
	}),
	category: one(categoryNode, {
		fields: [grievance.categoryNodeId],
		references: [categoryNode.id],
	}),
	form: one(formDefinition, {
		fields: [grievance.formDefinitionId],
		references: [formDefinition.id],
	}),
	attachments: many(attachment),
	events: many(grievanceEvent),
	feedback: many(feedback),
	appeals: many(appeal),
	publicCopies: many(publicGrievance),
	publicationPreviews: many(publicationPreview),
}));

export const grievanceDraftRelations = relations(
	grievanceDraft,
	({ one, many }) => ({
		user: one(user, {
			fields: [grievanceDraft.userId],
			references: [user.id],
		}),
		form: one(formDefinition, {
			fields: [grievanceDraft.formDefinitionId],
			references: [formDefinition.id],
		}),
		attachments: many(attachment),
		grievances: many(grievance),
	}),
);

export const grievanceEventRelations = relations(grievanceEvent, ({ one }) => ({
	grievance: one(grievance, {
		fields: [grievanceEvent.grievanceId],
		references: [grievance.id],
	}),
	actor: one(user, {
		fields: [grievanceEvent.actorUserId],
		references: [user.id],
	}),
}));

export const publicationPreviewRelations = relations(
	publicationPreview,
	({ one }) => ({
		grievance: one(grievance, {
			fields: [publicationPreview.grievanceId],
			references: [grievance.id],
		}),
		user: one(user, {
			fields: [publicationPreview.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [publicationPreview.organizationId],
			references: [organization.id],
		}),
	}),
);

export const publicGrievanceRelations = relations(
	publicGrievance,
	({ one, many }) => ({
		grievance: one(grievance, {
			fields: [publicGrievance.grievanceId],
			references: [grievance.id],
		}),
		organization: one(organization, {
			fields: [publicGrievance.organizationId],
			references: [organization.id],
		}),
		events: many(publicGrievanceEvent),
	}),
);

export const publicGrievanceEventRelations = relations(
	publicGrievanceEvent,
	({ one }) => ({
		publicGrievance: one(publicGrievance, {
			fields: [publicGrievanceEvent.publicGrievanceId],
			references: [publicGrievance.id],
		}),
		sourceEvent: one(grievanceEvent, {
			fields: [publicGrievanceEvent.sourceEventId],
			references: [grievanceEvent.id],
		}),
	}),
);

export const attachmentRelations = relations(attachment, ({ one }) => ({
	owner: one(user, {
		fields: [attachment.ownerUserId],
		references: [user.id],
	}),
	grievance: one(grievance, {
		fields: [attachment.grievanceId],
		references: [grievance.id],
	}),
	draft: one(grievanceDraft, {
		fields: [attachment.draftId],
		references: [grievanceDraft.id],
	}),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
	user: one(user, { fields: [userRole.userId], references: [user.id] }),
	role: one(role, { fields: [userRole.roleId], references: [role.id] }),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
	role: one(role, { fields: [rolePermission.roleId], references: [role.id] }),
	permission: one(permission, {
		fields: [rolePermission.permissionId],
		references: [permission.id],
	}),
}));
