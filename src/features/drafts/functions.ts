import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, notExists } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import {
	attachment,
	formDefinition,
	grievance,
	grievanceDraft,
	organization,
} from "#/db/schema";
import { authMiddleware } from "#/server/auth/middleware";

const answerValueSchema = z.union([
	z.string().max(20_000),
	z.number().finite(),
	z.boolean(),
	z.null(),
]);
const answersSchema = z
	.record(z.string().trim().min(1).max(200), answerValueSchema)
	.superRefine((answers, context) => {
		if (Object.keys(answers).length > 200)
			context.addIssue({ code: "custom", message: "Too many answers" });
		if (JSON.stringify(answers).length > 200_000)
			context.addIssue({ code: "custom", message: "Answers are too large" });
	});
const attachmentMetadataSchema = z
	.array(
		z
			.object({
				attachmentId: z.uuid(),
				fieldId: z.string().trim().min(1).max(200),
				name: z.string().trim().min(1).max(255),
				mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
				sizeBytes: z
					.number()
					.int()
					.positive()
					.max(5 * 1024 * 1024),
			})
			.strict(),
	)
	.max(1);

const formReferenceSchema = z.object({
	formKey: z.string().trim().min(1).max(240),
	formVersion: z.number().int().positive().max(100_000),
});

const saveDraftSchema = z
	.object({
		draftId: z.uuid().optional(),
		...formReferenceSchema.shape,
		language: z.enum(["en", "hi"]).default("en"),
		answers: answersSchema.default({}),
		remarks: z.string().trim().max(20_000).default(""),
		attachmentMetadata: attachmentMetadataSchema.default([]),
		publicConsent: z.enum(["not_set", "opted_in", "opted_out"]).optional(),
		aiConfidence: z
			.union([
				z.number().finite().min(0).max(1),
				z
					.string()
					.trim()
					.regex(/^0(?:\.\d+)?$|^1(?:\.0+)?$/),
			])
			.nullable()
			.optional(),
	})
	.strict();

const draftIdSchema = z.object({ draftId: z.uuid() }).strict();

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

function mapDraft(draft: typeof grievanceDraft.$inferSelect) {
	return {
		...draft,
		answers: toJsonRecord(draft.answers),
		attachmentMetadata: draft.attachmentMetadata.map((item) =>
			toJsonRecord(item),
		),
		createdAt: draft.createdAt.toISOString(),
		updatedAt: draft.updatedAt.toISOString(),
	};
}

function mapForm(form: typeof formDefinition.$inferSelect | null) {
	if (!form) return null;
	const title = form.schema.title;
	return {
		id: form.id,
		formKey: form.formKey,
		title: typeof title === "string" && title.trim() ? title : form.formKey,
		version: form.version,
		checksum: form.checksum,
		active: form.active,
	};
}

export type DraftListItem = {
	draft: ReturnType<typeof mapDraft>;
	form: ReturnType<typeof mapForm>;
	organization: { slug: string; name: string } | null;
};

async function findForm(formKey: string, formVersion: number) {
	const [form] = await db
		.select()
		.from(formDefinition)
		.where(
			and(
				eq(formDefinition.formKey, formKey),
				eq(formDefinition.version, formVersion),
				eq(formDefinition.active, true),
			),
		)
		.limit(1);
	if (!form) throw new Error("The selected form is no longer available");
	return form;
}

async function getOwnedDraft(userId: string, draftId: string) {
	const [row] = await db
		.select({ draft: grievanceDraft, form: formDefinition })
		.from(grievanceDraft)
		.leftJoin(
			formDefinition,
			eq(formDefinition.id, grievanceDraft.formDefinitionId),
		)
		.where(
			and(eq(grievanceDraft.id, draftId), eq(grievanceDraft.userId, userId)),
		)
		.limit(1);
	if (!row) throw new Error("Draft not found");
	const [submitted] = await db
		.select({ id: grievance.id })
		.from(grievance)
		.where(eq(grievance.draftId, row.draft.id))
		.limit(1);
	if (submitted) throw new Error("This draft has already been submitted");
	return { draft: mapDraft(row.draft), form: mapForm(row.form) };
}

export const saveDraft = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(saveDraftSchema)
	.handler(async ({ context, data }) => {
		const form = await findForm(data.formKey, data.formVersion);
		const publicConsent = data.publicConsent ?? "not_set";
		const aiConfidence = data.aiConfidence ?? null;
		const normalizedAiConfidence =
			aiConfidence === null ? null : Number(aiConfidence).toFixed(4);
		const { computeReviewHash } = await import("./review-hash.server");
		const reviewHash = await computeReviewHash({
			form,
			language: data.language,
			answers: data.answers,
			remarks: data.remarks || null,
			attachmentMetadata: data.attachmentMetadata,
			publicConsent,
			aiConfidence: normalizedAiConfidence,
		});
		if (data.draftId) {
			const draftId = data.draftId;
			return db.transaction(async (tx) => {
				const [owned] = await tx
					.select({ id: grievanceDraft.id })
					.from(grievanceDraft)
					.where(
						and(
							eq(grievanceDraft.id, draftId),
							eq(grievanceDraft.userId, context.session.user.id),
						),
					)
					.for("update")
					.limit(1);
				if (!owned) throw new Error("Draft not found");
				if (data.attachmentMetadata.length > 0) {
					const metadata = data.attachmentMetadata[0];
					if (!metadata) throw new Error("Attachment metadata is invalid");
					const [ownedAttachment] = await tx
						.select()
						.from(attachment)
						.where(
							and(
								eq(attachment.id, metadata.attachmentId),
								eq(attachment.draftId, owned.id),
								eq(attachment.ownerUserId, context.session.user.id),
								eq(attachment.status, "ready"),
							),
						)
						.limit(1);
					if (
						!ownedAttachment ||
						ownedAttachment.fieldId !== metadata.fieldId ||
						ownedAttachment.originalName !== metadata.name ||
						ownedAttachment.mimeType !== metadata.mimeType ||
						ownedAttachment.sizeBytes !== metadata.sizeBytes
					)
						throw new Error("Attachment metadata does not match the upload");
				}
				const [submitted] = await tx
					.select({ id: grievance.id })
					.from(grievance)
					.where(eq(grievance.draftId, owned.id))
					.limit(1);
				if (submitted) throw new Error("A submitted draft cannot be changed");
				const [updated] = await tx
					.update(grievanceDraft)
					.set({
						formDefinitionId: form.id,
						language: data.language,
						answers: data.answers,
						remarks: data.remarks || null,
						attachmentMetadata: data.attachmentMetadata,
						publicConsent,
						aiConfidence: normalizedAiConfidence,
						reviewHash,
						updatedAt: new Date(),
					})
					.where(eq(grievanceDraft.id, owned.id))
					.returning();
				if (!updated) throw new Error("Draft not found");
				return {
					draft: mapDraft(updated),
					form: { formKey: form.formKey, version: form.version },
				};
			});
		}
		if (data.attachmentMetadata.length > 0)
			throw new Error("Save the draft before adding an attachment");

		const [created] = await db
			.insert(grievanceDraft)
			.values({
				userId: context.session.user.id,
				formDefinitionId: form.id,
				language: data.language,
				answers: data.answers,
				remarks: data.remarks || null,
				attachmentMetadata: data.attachmentMetadata,
				publicConsent,
				aiConfidence: normalizedAiConfidence,
				reviewHash,
			})
			.returning();
		if (!created) throw new Error("Draft could not be saved");
		return {
			draft: mapDraft(created),
			form: { formKey: form.formKey, version: form.version },
		};
	});

export const listDrafts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const rows = await db
			.select({
				draft: grievanceDraft,
				form: formDefinition,
				organization,
			})
			.from(grievanceDraft)
			.leftJoin(
				formDefinition,
				eq(formDefinition.id, grievanceDraft.formDefinitionId),
			)
			.leftJoin(
				organization,
				eq(organization.id, formDefinition.organizationId),
			)
			.where(
				and(
					eq(grievanceDraft.userId, context.session.user.id),
					notExists(
						db
							.select({ id: grievance.id })
							.from(grievance)
							.where(eq(grievance.draftId, grievanceDraft.id)),
					),
				),
			)
			.orderBy(desc(grievanceDraft.updatedAt))
			.limit(50);
		return rows.map((row) => ({
			draft: mapDraft(row.draft),
			form: mapForm(row.form),
			organization: row.organization
				? { slug: row.organization.slug, name: row.organization.name }
				: null,
		}));
	});

export const getDraft = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(draftIdSchema)
	.handler(async ({ context, data }) =>
		getOwnedDraft(context.session.user.id, data.draftId),
	);

export const deleteDraft = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(draftIdSchema)
	.handler(async ({ context, data }) => {
		const ownedAttachments = await db.transaction(async (tx) => {
			const [owned] = await tx
				.select({ id: grievanceDraft.id })
				.from(grievanceDraft)
				.where(
					and(
						eq(grievanceDraft.id, data.draftId),
						eq(grievanceDraft.userId, context.session.user.id),
					),
				)
				.for("update")
				.limit(1);
			if (!owned) throw new Error("Draft not found");
			const [submitted] = await tx
				.select({ id: grievance.id })
				.from(grievance)
				.where(eq(grievance.draftId, owned.id))
				.limit(1);
			if (submitted) throw new Error("A submitted draft cannot be deleted");
			const paths = await tx
				.select({ pathname: attachment.pathname })
				.from(attachment)
				.where(
					and(
						eq(attachment.draftId, owned.id),
						eq(attachment.ownerUserId, context.session.user.id),
					),
				);
			await tx.delete(grievanceDraft).where(eq(grievanceDraft.id, owned.id));
			return paths;
		});
		if (ownedAttachments.length > 0) {
			const { del } = await import("@vercel/blob");
			await del(ownedAttachments.map((item) => item.pathname)).catch(
				() => undefined,
			);
		}
		return { ok: true };
	});
