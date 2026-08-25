import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import {
	appeal,
	attachment,
	categoryNode,
	feedback,
	formDefinition,
	grievance,
	grievanceDraft,
	grievanceEvent,
	organization,
	publicGrievance,
} from "#/db/schema";
import { projectPublicStatusEvent } from "#/features/public-grievances/projection.server";
import { authMiddleware } from "#/server/auth/middleware";
import {
	CITIZEN_PERMISSIONS,
	requirePermissionForSession,
} from "#/server/auth/permissions";

const registrationIdSchema = z
	.object({ registrationId: z.string().trim().min(1).max(80) })
	.strict();
const submitSchema = z
	.object({
		draftId: z.uuid(),
		reviewHash: z.string().trim().min(1).max(128),
		idempotencyKey: z.string().trim().min(1).max(160),
	})
	.strict();
const replySchema = registrationIdSchema
	.extend({ message: z.string().trim().min(1).max(20_000) })
	.strict();
const feedbackSchema = registrationIdSchema
	.extend({
		score: z.number().int().min(1).max(5),
		comment: z.string().trim().max(4_000).optional(),
	})
	.strict();
const appealSchema = registrationIdSchema
	.extend({ reason: z.string().trim().min(1).max(20_000) })
	.strict();

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };
function toJsonValue(value: unknown): JsonValue {
	if (value === null) return null;
	if (typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (Array.isArray(value)) return value.map(toJsonValue);
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [key, toJsonValue(child)]),
		);
	}
	return String(value);
}
function toJsonRecord(
	value: Record<string, unknown>,
): Record<string, JsonValue> {
	return toJsonValue(value) as Record<string, JsonValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FormField = {
	id: string;
	kind: "text" | "number" | "select" | "textarea" | "file";
	required: boolean;
	active: boolean;
	maximumLength: number | null;
	pattern: string | null;
	options?: string[];
};

const formFieldKinds = new Set([
	"text",
	"number",
	"select",
	"textarea",
	"file",
]);

function isFormFieldKind(value: unknown): value is FormField["kind"] {
	return typeof value === "string" && formFieldKinds.has(value);
}

function nextDemoStatus(
	status: typeof grievance.$inferSelect.status,
): typeof grievance.$inferSelect.status | null {
	switch (status) {
		case "submitted":
			return "acknowledged";
		case "acknowledged":
			return "routed";
		case "routed":
			return "in_review";
		case "in_review":
			return "needs_information";
		case "needs_information":
			return "action_taken";
		case "action_taken":
			return "resolved";
		default:
			return null;
	}
}

function readFormFields(schema: Record<string, unknown>): FormField[] {
	if (!Array.isArray(schema.fields))
		throw new Error("The selected form has no valid fields");
	const fields: FormField[] = [];
	const fieldIds = new Set<string>();
	for (const value of schema.fields) {
		if (
			!isRecord(value) ||
			typeof value.id !== "string" ||
			value.id.trim() === "" ||
			value.id.length > 200 ||
			!isFormFieldKind(value.kind) ||
			typeof value.required !== "boolean"
		) {
			throw new Error("The selected form has invalid fields");
		}
		if (fieldIds.has(value.id))
			throw new Error("The selected form has duplicate fields");
		fieldIds.add(value.id);
		const options =
			Array.isArray(value.options) &&
			value.options.every(
				(option): option is string =>
					typeof option === "string" && option.trim().length > 0,
			)
				? value.options
				: undefined;
		if (value.kind === "select" && (!options || options.length === 0))
			throw new Error("The selected form has invalid select options");
		if (value.kind !== "select" && value.options !== undefined)
			throw new Error("The selected form has invalid fields");
		if (
			value.maximumLength !== undefined &&
			(value.kind === "file" ||
				typeof value.maximumLength !== "number" ||
				!Number.isSafeInteger(value.maximumLength) ||
				value.maximumLength < 0)
		)
			throw new Error("The selected form has invalid field limits");
		if (
			value.pattern !== undefined &&
			(value.kind === "file" ||
				typeof value.pattern !== "string" ||
				value.pattern.length > 1_000)
		)
			throw new Error("The selected form has invalid field patterns");
		fields.push({
			id: value.id,
			kind: value.kind,
			required: value.required,
			active: typeof value.active === "boolean" ? value.active : true,
			maximumLength:
				typeof value.maximumLength === "number" ? value.maximumLength : null,
			pattern: typeof value.pattern === "string" ? value.pattern : null,
			options,
		});
	}
	return fields;
}

function answerIsEmpty(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		(typeof value === "string" && value.trim() === "")
	);
}

function validateAnswers(
	formSchema: Record<string, unknown>,
	answers: Record<string, unknown>,
	attachmentMetadata: Array<Record<string, unknown>>,
) {
	const fields = readFormFields(formSchema);
	const activeFields = fields.filter((field) => field.active !== false);
	const fieldIds = new Set(activeFields.map((field) => field.id));
	for (const answerKey of Object.keys(answers)) {
		if (!fieldIds.has(answerKey))
			throw new Error(`Answer is not part of this form: ${answerKey}`);
	}
	const fileFieldIds = new Set(
		activeFields
			.filter((field) => field.kind === "file")
			.map((field) => field.id),
	);
	if (attachmentMetadata.length > 1)
		throw new Error("Only one attachment is allowed");
	for (const metadata of attachmentMetadata) {
		const attachmentId = metadata.attachmentId;
		const fieldId = metadata.fieldId;
		const name = metadata.name;
		const mimeType = metadata.mimeType;
		const sizeBytes = metadata.sizeBytes;
		if (
			typeof attachmentId !== "string" ||
			typeof fieldId !== "string" ||
			!fileFieldIds.has(fieldId) ||
			typeof name !== "string" ||
			name.trim() === "" ||
			!["application/pdf", "image/jpeg", "image/png"].includes(
				String(mimeType),
			) ||
			typeof sizeBytes !== "number" ||
			!Number.isSafeInteger(sizeBytes) ||
			sizeBytes <= 0 ||
			sizeBytes > 5 * 1024 * 1024
		)
			throw new Error("Attachment metadata is invalid");
	}
	for (const field of activeFields) {
		const answer = answers[field.id];
		const files = attachmentMetadata.filter(
			(item) => item.fieldId === field.id,
		);
		if (field.kind === "file") {
			if (field.required && files.length === 0)
				throw new Error(`Answer required: ${field.id}`);
			if (!answerIsEmpty(answer))
				throw new Error(`Answer is invalid: ${field.id}`);
			continue;
		}
		if (field.required && answerIsEmpty(answer))
			throw new Error(`Answer required: ${field.id}`);
		if (answerIsEmpty(answer)) continue;
		if (field.kind !== "number" && typeof answer !== "string")
			throw new Error(`Answer is invalid: ${field.id}`);
		if (
			field.kind === "number" &&
			(typeof answer === "boolean" ||
				(typeof answer !== "string" && typeof answer !== "number") ||
				!Number.isFinite(Number(answer)))
		)
			throw new Error(`Answer is invalid: ${field.id}`);
		const text = String(answer);
		if (text.length > 20_000)
			throw new Error(`Answer is too long: ${field.id}`);
		if (field.maximumLength !== null && text.length > field.maximumLength)
			throw new Error(`Answer is too long: ${field.id}`);
		if (
			field.kind === "select" &&
			(!field.options || !field.options.includes(text))
		)
			throw new Error(`Answer is not an option: ${field.id}`);
		if (field.pattern) {
			if (field.pattern.length > 1_000)
				throw new Error(`Answer pattern is invalid: ${field.id}`);
			try {
				if (!new RegExp(field.pattern).test(text))
					throw new Error(`Answer has invalid format: ${field.id}`);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.startsWith("Answer has invalid format")
				)
					throw error;
				throw new Error(`Answer pattern is invalid: ${field.id}`);
			}
		}
	}
}

function iso(value: Date | null): string | null {
	return value ? value.toISOString() : null;
}

function receipt(row: typeof grievance.$inferSelect) {
	return {
		id: row.id,
		registrationId: row.registrationId,
		status: row.status,
		submittedAt: row.submittedAt.toISOString(),
		trackingPath: `/grievances/${encodeURIComponent(row.registrationId)}`,
	};
}

async function registrationId(): Promise<string> {
	const { randomBytes } = await import("node:crypto");
	const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
	return `UGAAP-DEMO-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function ownedGrievance(userId: string, registrationIdValue: string) {
	const [row] = await db
		.select()
		.from(grievance)
		.where(
			and(
				eq(grievance.userId, userId),
				eq(grievance.registrationId, registrationIdValue),
			),
		)
		.limit(1);
	if (!row) throw new Error("Grievance not found");
	return row;
}

export type GrievanceListItem = {
	id: string;
	registrationId: string;
	status: typeof grievance.$inferSelect.status;
	formTitle: string;
	organizationName: string;
	submittedAt: string;
	updatedAt: string;
};

export type GrievanceDetail = {
	id: string;
	registrationId: string;
	status: typeof grievance.$inferSelect.status;
	language: string;
	answers: Record<string, JsonValue>;
	remarks: string;
	publicConsent: typeof grievance.$inferSelect.publicConsent;
	organization: { id: string; name: string; slug: string };
	categoryPath: string[];
	form: {
		id: string;
		title: string;
		formKey: string;
		version: number;
		checksum: string;
	};
	fields: Array<{ id: string; label: string }>;
	attachments: Array<{
		id: string;
		name: string;
		mimeType: string;
		sizeBytes: number;
	}>;
	events: Array<{
		id: string;
		eventType: string;
		actorType: string;
		fromStatus: string | null;
		toStatus: string | null;
		message: string | null;
		metadata: Record<string, JsonValue> | null;
		createdAt: string;
	}>;
	feedback: { score: number; comment: string | null; createdAt: string } | null;
	appeal: {
		reason: string;
		status: string;
		resolution: string | null;
		createdAt: string;
	} | null;
	closure: {
		reason: string | null;
		note: string | null;
		closedAt: string | null;
		appealEligibleUntil: string | null;
	};
	submittedAt: string;
	demoMode: boolean;
	publication: {
		publicId: string;
		summary: string;
		broadLocation: string | null;
		publishedAt: string;
		withdrawnAt: string | null;
	} | null;
};

export const submitGrievance = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(submitSchema)
	.handler(async ({ context, data }) => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.CREATE_GRIEVANCE,
		);
		return db.transaction(async (tx) => {
			const [existing] = await tx
				.select()
				.from(grievance)
				.where(
					and(
						eq(grievance.userId, context.session.user.id),
						eq(grievance.idempotencyKey, data.idempotencyKey),
					),
				)
				.for("update")
				.limit(1);
			if (existing) {
				if (
					existing.draftId !== data.draftId ||
					existing.reviewHash !== data.reviewHash
				)
					throw new Error("The idempotency key was used for another request");
				return receipt(existing);
			}
			const [row] = await tx
				.select({ draft: grievanceDraft, form: formDefinition })
				.from(grievanceDraft)
				.innerJoin(
					formDefinition,
					eq(formDefinition.id, grievanceDraft.formDefinitionId),
				)
				.where(
					and(
						eq(grievanceDraft.id, data.draftId),
						eq(grievanceDraft.userId, context.session.user.id),
					),
				)
				.for("update")
				.limit(1);
			if (!row) throw new Error("Draft not found");
			const [submittedDraft] = await tx
				.select({ id: grievance.id })
				.from(grievance)
				.where(eq(grievance.draftId, row.draft.id))
				.limit(1);
			if (submittedDraft)
				throw new Error("This draft has already been submitted");
			if (!row.form.active)
				throw new Error("The selected form is no longer available");
			if (!row.draft.reviewHash || row.draft.reviewHash !== data.reviewHash)
				throw new Error("Draft review is stale");
			const { computeReviewHash } = await import(
				"#/features/drafts/review-hash.server"
			);
			const expectedHash = computeReviewHash({
				form: row.form,
				language: row.draft.language,
				answers: row.draft.answers,
				remarks: row.draft.remarks,
				attachmentMetadata: row.draft.attachmentMetadata,
				publicConsent: row.draft.publicConsent,
				aiConfidence: row.draft.aiConfidence,
			});
			if (expectedHash !== data.reviewHash)
				throw new Error("Draft review is stale");
			validateAnswers(
				row.form.schema,
				row.draft.answers,
				row.draft.attachmentMetadata,
			);
			const draftAttachments = await tx
				.select()
				.from(attachment)
				.where(
					and(
						eq(attachment.draftId, row.draft.id),
						eq(attachment.ownerUserId, context.session.user.id),
					),
				);
			const allAttachments = await tx
				.select({ id: attachment.id })
				.from(attachment)
				.where(eq(attachment.draftId, row.draft.id));
			if (
				draftAttachments.length !== allAttachments.length ||
				draftAttachments.some((item) => item.status !== "ready")
			)
				throw new Error("All attachments must be ready");
			if (
				row.draft.attachmentMetadata.length > 0 &&
				draftAttachments.length === 0
			)
				throw new Error("The selected attachment has not finished uploading");
			if (row.draft.attachmentMetadata.length !== draftAttachments.length)
				throw new Error("Attachment metadata is incomplete");
			for (const item of draftAttachments) {
				const metadata = row.draft.attachmentMetadata.find(
					(candidate) => candidate.attachmentId === item.id,
				);
				if (
					!metadata ||
					metadata.fieldId !== item.fieldId ||
					metadata.name !== item.originalName ||
					metadata.mimeType !== item.mimeType ||
					metadata.sizeBytes !== item.sizeBytes
				)
					throw new Error("Attachment metadata does not match the upload");
			}
			if (
				draftAttachments.some(
					(item) =>
						item.sizeBytes > 5 * 1024 * 1024 ||
						!["application/pdf", "image/jpeg", "image/png"].includes(
							item.mimeType,
						),
				)
			)
				throw new Error("Attachment must be a PDF, JPEG, or PNG up to 4 MB");
			const now = new Date();
			const [created] = await tx
				.insert(grievance)
				.values({
					registrationId: await registrationId(),
					userId: context.session.user.id,
					draftId: row.draft.id,
					organizationId: row.form.organizationId,
					categoryNodeId: row.form.categoryNodeId,
					formDefinitionId: row.form.id,
					status: "submitted",
					language: row.draft.language,
					answers: row.draft.answers,
					remarks: row.draft.remarks ?? "",
					reviewHash: data.reviewHash,
					idempotencyKey: data.idempotencyKey,
					publicConsent: row.draft.publicConsent,
					submittedAt: now,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoNothing()
				.returning();
			if (!created) {
				const [winner] = await tx
					.select()
					.from(grievance)
					.where(
						and(
							eq(grievance.userId, context.session.user.id),
							eq(grievance.idempotencyKey, data.idempotencyKey),
						),
					)
					.limit(1);
				if (!winner) {
					const [submittedDraft] = await tx
						.select({ id: grievance.id })
						.from(grievance)
						.where(eq(grievance.draftId, row.draft.id))
						.limit(1);
					if (submittedDraft)
						throw new Error("This draft has already been submitted");
					throw new Error("Grievance could not be submitted");
				}
				if (
					winner.draftId !== data.draftId ||
					winner.reviewHash !== data.reviewHash
				)
					throw new Error("The idempotency key was used for another request");
				return receipt(winner);
			}
			await tx.insert(grievanceEvent).values({
				grievanceId: created.id,
				eventType: "submitted",
				actorType: "citizen",
				actorUserId: context.session.user.id,
				toStatus: "submitted",
				message: "Grievance submitted.",
			});
			if (draftAttachments.length > 0) {
				const movedAttachments = await tx
					.update(attachment)
					.set({ grievanceId: created.id, draftId: null })
					.where(
						and(
							eq(attachment.draftId, row.draft.id),
							eq(attachment.ownerUserId, context.session.user.id),
						),
					)
					.returning({ id: attachment.id });
				if (movedAttachments.length !== draftAttachments.length)
					throw new Error("Attachments could not be submitted");
			}
			return receipt(created);
		});
	});

export const listGrievances = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.READ_OWN_GRIEVANCES,
		);
		const rows = await db
			.select({ grievance, form: formDefinition, organization })
			.from(grievance)
			.innerJoin(
				formDefinition,
				eq(formDefinition.id, grievance.formDefinitionId),
			)
			.innerJoin(organization, eq(organization.id, grievance.organizationId))
			.where(eq(grievance.userId, context.session.user.id))
			.orderBy(desc(grievance.submittedAt))
			.limit(100);
		return rows.map(
			({ grievance: row, form, organization: org }): GrievanceListItem => ({
				id: row.id,
				registrationId: row.registrationId,
				status: row.status,
				formTitle:
					typeof form.schema.title === "string" && form.schema.title.trim()
						? form.schema.title
						: form.formKey,
				organizationName: org.name,
				submittedAt: row.submittedAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			}),
		);
	});

export const getGrievance = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(registrationIdSchema)
	.handler(async ({ context, data }): Promise<GrievanceDetail> => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.READ_OWN_GRIEVANCES,
		);
		const row = await ownedGrievance(
			context.session.user.id,
			data.registrationId,
		);
		const [
			[joined],
			attachments,
			events,
			[feedbackRow],
			[appealRow],
			[publicationRow],
		] = await Promise.all([
			db
				.select({
					grievance,
					organization,
					category: categoryNode,
					form: formDefinition,
				})
				.from(grievance)
				.innerJoin(organization, eq(organization.id, grievance.organizationId))
				.innerJoin(categoryNode, eq(categoryNode.id, grievance.categoryNodeId))
				.innerJoin(
					formDefinition,
					eq(formDefinition.id, grievance.formDefinitionId),
				)
				.where(eq(grievance.id, row.id))
				.limit(1),
			db
				.select()
				.from(attachment)
				.where(eq(attachment.grievanceId, row.id))
				.orderBy(asc(attachment.createdAt)),
			db
				.select()
				.from(grievanceEvent)
				.where(eq(grievanceEvent.grievanceId, row.id))
				.orderBy(asc(grievanceEvent.createdAt), asc(grievanceEvent.id)),
			db
				.select()
				.from(feedback)
				.where(eq(feedback.grievanceId, row.id))
				.limit(1),
			db.select().from(appeal).where(eq(appeal.grievanceId, row.id)).limit(1),
			db
				.select()
				.from(publicGrievance)
				.where(eq(publicGrievance.grievanceId, row.id))
				.limit(1),
		]);
		if (!joined) throw new Error("Grievance not found");
		const title =
			typeof joined.form.schema.title === "string" &&
			joined.form.schema.title.trim()
				? joined.form.schema.title
				: joined.form.formKey;
		const categoryPath =
			Array.isArray(joined.form.schema.categoryPath) &&
			joined.form.schema.categoryPath.every(
				(part): part is string => typeof part === "string",
			)
				? joined.form.schema.categoryPath
				: [joined.category.name];
		const fields = Array.isArray(joined.form.schema.fields)
			? joined.form.schema.fields.flatMap((field) => {
					if (
						!isRecord(field) ||
						typeof field.id !== "string" ||
						field.active === false
					)
						return [];
					return [
						{
							id: field.id,
							label:
								typeof field.label === "string" && field.label.trim()
									? field.label
									: field.id,
						},
					];
				})
			: [];
		return {
			id: row.id,
			registrationId: row.registrationId,
			status: row.status,
			language: row.language,
			answers: toJsonRecord(row.answers),
			remarks: row.remarks,
			publicConsent: row.publicConsent,
			submittedAt: row.submittedAt.toISOString(),
			demoMode: process.env.DEMO_MODE === "true",
			organization: {
				id: joined.organization.id,
				name: joined.organization.name,
				slug: joined.organization.slug,
			},
			categoryPath,
			form: {
				id: joined.form.id,
				title,
				formKey: joined.form.formKey,
				version: joined.form.version,
				checksum: joined.form.checksum,
			},
			fields,
			attachments: attachments.map((item) => ({
				id: item.id,
				name: item.originalName,
				mimeType: item.mimeType,
				sizeBytes: item.sizeBytes,
			})),
			events: events.map((event) => ({
				id: event.id,
				eventType: event.eventType,
				actorType: event.actorType,
				fromStatus: event.fromStatus,
				toStatus: event.toStatus,
				message: event.message,
				metadata: event.metadata ? toJsonRecord(event.metadata) : null,
				createdAt: event.createdAt.toISOString(),
			})),
			feedback: feedbackRow
				? {
						score: feedbackRow.score,
						comment: feedbackRow.comment,
						createdAt: feedbackRow.createdAt.toISOString(),
					}
				: null,
			appeal: appealRow
				? {
						reason: appealRow.reason,
						status: appealRow.status,
						resolution: appealRow.resolution,
						createdAt: appealRow.createdAt.toISOString(),
					}
				: null,
			closure: {
				reason: row.closureReason,
				note: row.closureNote,
				closedAt: iso(row.closedAt),
				appealEligibleUntil: iso(row.appealEligibleUntil),
			},
			publication: publicationRow
				? {
						publicId: publicationRow.publicId,
						summary: publicationRow.summary,
						broadLocation: publicationRow.broadLocation,
						publishedAt: publicationRow.publishedAt.toISOString(),
						withdrawnAt: iso(publicationRow.withdrawnAt),
					}
				: null,
		};
	});

export const advanceDemoGrievance = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(registrationIdSchema)
	.handler(async ({ context, data }) => {
		if (process.env.DEMO_MODE !== "true")
			throw new Error("Demo mode is disabled");
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.READ_OWN_GRIEVANCES,
		);
		return db.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(grievance)
				.where(
					and(
						eq(grievance.userId, context.session.user.id),
						eq(grievance.registrationId, data.registrationId),
					),
				)
				.for("update")
				.limit(1);
			if (!row) throw new Error("Grievance not found");
			const next = nextDemoStatus(row.status);
			if (!next)
				throw new Error("Grievance cannot advance from its current status");
			if (
				row.status === "needs_information" &&
				row.citizenResponseDueAt !== null
			)
				throw new Error(
					"A clarification reply is required before this case can advance",
				);
			const now = new Date();
			const isNeedsInformation = next === "needs_information";
			const isResolved = next === "resolved";
			const [updated] = await tx
				.update(grievance)
				.set({
					status: next,
					citizenResponseDueAt: isNeedsInformation
						? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
						: null,
					closureReason: isResolved ? "department_action_unconfirmed" : null,
					closedAt: isResolved ? now : null,
					closureNote: isResolved ? "Demo case resolved." : null,
					appealEligibleUntil: isResolved
						? new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)
						: null,
					updatedAt: now,
				})
				.where(and(eq(grievance.id, row.id), eq(grievance.status, row.status)))
				.returning();
			if (!updated) throw new Error("Grievance could not be advanced");
			const [statusEvent] = await tx
				.insert(grievanceEvent)
				.values({
					grievanceId: row.id,
					eventType: "status_changed",
					actorType: "system",
					fromStatus: row.status,
					toStatus: next,
					message: `Status changed to ${next}.`,
					createdAt: now,
				})
				.returning({ id: grievanceEvent.id });
			if (!statusEvent) throw new Error("Grievance status event was not saved");
			await projectPublicStatusEvent(tx, {
				grievanceId: row.id,
				sourceEventId: statusEvent.id,
				status: next,
				occurredAt: now,
			});
			if (isNeedsInformation)
				await tx.insert(grievanceEvent).values({
					grievanceId: row.id,
					eventType: "clarification_requested",
					actorType: "officer",
					toStatus: "needs_information",
					message:
						"Please provide any additional details that can help resolve this matter.",
					metadata: {
						question:
							"Please provide any additional details that can help resolve this matter.",
						responseDueAt: new Date(
							now.getTime() + 7 * 24 * 60 * 60 * 1000,
						).toISOString(),
					},
					createdAt: new Date(now.getTime() + 1),
				});
			return receipt(updated);
		});
	});

export const replyToClarification = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(replySchema)
	.handler(async ({ context, data }) => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.REPLY_OWN_GRIEVANCE,
		);
		return db.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(grievance)
				.where(
					and(
						eq(grievance.userId, context.session.user.id),
						eq(grievance.registrationId, data.registrationId),
					),
				)
				.for("update")
				.limit(1);
			if (!row) throw new Error("Grievance not found");
			if (row.status !== "needs_information")
				throw new Error("Grievance is not awaiting information");
			if (row.citizenResponseDueAt === null)
				throw new Error("This clarification request has already been answered");
			const [updated] = await tx
				.update(grievance)
				.set({ citizenResponseDueAt: null, updatedAt: new Date() })
				.where(
					and(
						eq(grievance.id, row.id),
						eq(grievance.status, "needs_information"),
						isNotNull(grievance.citizenResponseDueAt),
					),
				)
				.returning();
			if (!updated) throw new Error("Reply could not be saved");
			await tx.insert(grievanceEvent).values({
				grievanceId: row.id,
				eventType: "clarification_replied",
				actorType: "citizen",
				actorUserId: context.session.user.id,
				message: data.message,
			});
			return { ok: true as const, registrationId: updated.registrationId };
		});
	});

export const submitFeedback = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(feedbackSchema)
	.handler(async ({ context, data }) => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.READ_OWN_GRIEVANCES,
		);
		return db.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(grievance)
				.where(
					and(
						eq(grievance.userId, context.session.user.id),
						eq(grievance.registrationId, data.registrationId),
					),
				)
				.limit(1);
			if (!row) throw new Error("Grievance not found");
			if (row.status !== "resolved")
				throw new Error("Feedback is available only for resolved grievances");
			const [existing] = await tx
				.select({ id: feedback.id })
				.from(feedback)
				.where(eq(feedback.grievanceId, row.id))
				.limit(1);
			if (existing) throw new Error("Feedback has already been submitted");
			const [created] = await tx
				.insert(feedback)
				.values({
					grievanceId: row.id,
					userId: context.session.user.id,
					score: data.score,
					comment: data.comment || null,
				})
				.onConflictDoNothing({ target: feedback.grievanceId })
				.returning();
			if (!created) throw new Error("Feedback could not be saved");
			await tx.insert(grievanceEvent).values({
				grievanceId: row.id,
				eventType: "feedback_received",
				actorType: "citizen",
				actorUserId: context.session.user.id,
				message: "Resolution feedback received.",
				metadata: { score: data.score },
			});
			return { ok: true as const, score: created.score };
		});
	});

export const submitAppeal = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(appealSchema)
	.handler(async ({ context, data }) => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.CREATE_APPEAL,
		);
		return db.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(grievance)
				.where(
					and(
						eq(grievance.userId, context.session.user.id),
						eq(grievance.registrationId, data.registrationId),
					),
				)
				.limit(1);
			if (!row) throw new Error("Grievance not found");
			if (row.status !== "resolved")
				throw new Error("Appeals are available only for resolved grievances");
			if (!row.appealEligibleUntil || row.appealEligibleUntil <= new Date())
				throw new Error("The appeal period has expired");
			const [score] = await tx
				.select({ value: feedback.score })
				.from(feedback)
				.where(eq(feedback.grievanceId, row.id))
				.limit(1);
			if (!score || score.value > 2)
				throw new Error("A low feedback score is required to appeal");
			const [existing] = await tx
				.select({ id: appeal.id })
				.from(appeal)
				.where(eq(appeal.grievanceId, row.id))
				.limit(1);
			if (existing) throw new Error("An appeal has already been submitted");
			const [created] = await tx
				.insert(appeal)
				.values({
					grievanceId: row.id,
					userId: context.session.user.id,
					reason: data.reason,
					status: "filed",
				})
				.onConflictDoNothing({ target: appeal.grievanceId })
				.returning();
			if (!created) throw new Error("Appeal could not be saved");
			const [updated] = await tx
				.update(grievance)
				.set({ status: "appealed", updatedAt: new Date() })
				.where(eq(grievance.id, row.id))
				.returning();
			if (!updated) throw new Error("Appeal could not be saved");
			const appealCreatedAt = new Date();
			const [appealEvent] = await tx
				.insert(grievanceEvent)
				.values({
					grievanceId: row.id,
					eventType: "appeal_filed",
					actorType: "citizen",
					actorUserId: context.session.user.id,
					fromStatus: "resolved",
					toStatus: "appealed",
					message: "Appeal filed.",
					createdAt: appealCreatedAt,
				})
				.returning({ id: grievanceEvent.id });
			if (!appealEvent) throw new Error("Appeal event was not saved");
			await projectPublicStatusEvent(tx, {
				grievanceId: row.id,
				sourceEventId: appealEvent.id,
				status: "appealed",
				occurredAt: appealCreatedAt,
			});
			return {
				ok: true as const,
				registrationId: updated.registrationId,
				status: updated.status,
			};
		});
	});
