import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import {
	attachment,
	formDefinition,
	grievance,
	grievanceDraft,
} from "#/db/schema";
import { authMiddleware } from "#/server/auth/middleware";
import {
	ATTACHMENT_MIME_TYPES,
	attachmentExtension,
	expectedMimeForExtension,
	MAX_ATTACHMENT_BYTES,
} from "./constants";

const prepareSchema = z
	.object({
		draftId: z.uuid(),
		fieldId: z.string().trim().min(1).max(200),
		name: z.string().trim().min(1).max(255),
		mimeType: z.enum(ATTACHMENT_MIME_TYPES),
		sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
		checksum: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
const attachmentIdSchema = z.object({ attachmentId: z.uuid() }).strict();

function safeName(name: string) {
	const basename = name.split(/[\\/]/).pop()?.trim() ?? "";
	if (
		!basename ||
		[...basename].some((character) => {
			const code = character.charCodeAt(0);
			return code < 32 || code === 127;
		})
	)
		throw new Error("Attachment name is invalid");
	return basename;
}

function fileFieldIds(schema: Record<string, unknown>) {
	if (!Array.isArray(schema.fields)) return new Set<string>();
	return new Set(
		schema.fields.flatMap((field) => {
			if (
				typeof field === "object" &&
				field !== null &&
				!Array.isArray(field) &&
				field.kind === "file" &&
				field.active !== false &&
				typeof field.id === "string"
			)
				return [field.id];
			return [];
		}),
	);
}

export const prepareAttachment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(prepareSchema)
	.handler(async ({ context, data }) => {
		const name = safeName(data.name);
		const extension = attachmentExtension(name);
		if (expectedMimeForExtension(extension) !== data.mimeType)
			throw new Error("Attachment extension and type do not match");
		return db.transaction(async (tx) => {
			const [owned] = await tx
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
			if (!owned) throw new Error("Draft not found");
			if (!fileFieldIds(owned.form.schema).has(data.fieldId))
				throw new Error("Attachment field is not part of this form");
			const [submitted] = await tx
				.select({ id: grievance.id })
				.from(grievance)
				.where(eq(grievance.draftId, owned.draft.id))
				.limit(1);
			if (submitted) throw new Error("A submitted draft cannot be changed");
			const [existing] = await tx
				.select({ id: attachment.id })
				.from(attachment)
				.where(eq(attachment.draftId, owned.draft.id))
				.limit(1);
			if (existing) throw new Error("Remove the existing attachment first");

			const id = globalThis.crypto.randomUUID();
			const pathname = `grievances/${owned.draft.id}/${id}.${extension}`;
			await tx.insert(attachment).values({
				id,
				ownerUserId: context.session.user.id,
				draftId: owned.draft.id,
				pathname,
				originalName: name,
				fieldId: data.fieldId,
				mimeType: data.mimeType,
				sizeBytes: data.sizeBytes,
				checksum: data.checksum,
				status: "pending",
			});
			return { attachmentId: id, pathname };
		});
	});

export const removeAttachment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(attachmentIdSchema)
	.handler(async ({ context, data }) => {
		const [removed] = await db
			.delete(attachment)
			.where(
				and(
					eq(attachment.id, data.attachmentId),
					eq(attachment.ownerUserId, context.session.user.id),
				),
			)
			.returning({ pathname: attachment.pathname });
		if (!removed) throw new Error("Attachment not found");
		const { del } = await import("@vercel/blob");
		await del(removed.pathname).catch(() => undefined);
		return { ok: true as const };
	});
