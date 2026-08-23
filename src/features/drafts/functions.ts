import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { formDefinition, grievanceDraft, organization } from "#/db/schema";
import { authMiddleware } from "#/server/auth/middleware";

const answersSchema = z.record(z.string().trim().min(1).max(200), z.unknown());
const attachmentMetadataSchema = z
	.array(z.record(z.string().trim().min(1).max(80), z.unknown()))
	.max(20);

const formReferenceSchema = z.object({
	formKey: z.string().trim().min(1).max(240),
	formVersion: z.number().int().positive().max(100_000),
});

const saveDraftSchema = z
	.object({
		draftId: z.string().uuid().optional(),
		...formReferenceSchema.shape,
		language: z.enum(["en", "hi"]).default("en"),
		answers: answersSchema.default({}),
		remarks: z.string().trim().max(20_000).default(""),
		attachmentMetadata: attachmentMetadataSchema.default([]),
	})
	.strict();

const draftIdSchema = z.object({ draftId: z.string().uuid() }).strict();

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
	return { draft: mapDraft(row.draft), form: mapForm(row.form) };
}

export const saveDraft = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(saveDraftSchema)
	.handler(async ({ context, data }) => {
		const form = await findForm(data.formKey, data.formVersion);
		if (data.draftId) {
			await getOwnedDraft(context.session.user.id, data.draftId);
			const [updated] = await db
				.update(grievanceDraft)
				.set({
					formDefinitionId: form.id,
					language: data.language,
					answers: data.answers,
					remarks: data.remarks || null,
					attachmentMetadata: data.attachmentMetadata,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(grievanceDraft.id, data.draftId),
						eq(grievanceDraft.userId, context.session.user.id),
					),
				)
				.returning();
			if (!updated) throw new Error("Draft not found");
			return {
				draft: mapDraft(updated),
				form: { formKey: form.formKey, version: form.version },
			};
		}

		const [created] = await db
			.insert(grievanceDraft)
			.values({
				userId: context.session.user.id,
				formDefinitionId: form.id,
				language: data.language,
				answers: data.answers,
				remarks: data.remarks || null,
				attachmentMetadata: data.attachmentMetadata,
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
			.where(eq(grievanceDraft.userId, context.session.user.id))
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
		const deleted = await db
			.delete(grievanceDraft)
			.where(
				and(
					eq(grievanceDraft.id, data.draftId),
					eq(grievanceDraft.userId, context.session.user.id),
				),
			)
			.returning({ id: grievanceDraft.id });
		if (deleted.length === 0) throw new Error("Draft not found");
		return { ok: true };
	});
