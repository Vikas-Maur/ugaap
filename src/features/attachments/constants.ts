import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export const ATTACHMENT_MIME_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

export const readyAttachmentSchema = z
	.object({
		id: z.uuid(),
		fieldId: z.string(),
		name: z.string(),
		mimeType: z.enum(ATTACHMENT_MIME_TYPES),
		sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
	})
	.strict();

export type ReadyAttachment = z.infer<typeof readyAttachmentSchema>;

export function attachmentExtension(name: string): string | null {
	const match = /\.([a-z0-9]+)$/i.exec(name.trim());
	return match?.[1]?.toLowerCase() ?? null;
}

export function expectedMimeForExtension(
	extension: string | null,
): AttachmentMimeType | null {
	if (extension === "pdf") return "application/pdf";
	if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
	if (extension === "png") return "image/png";
	return null;
}
