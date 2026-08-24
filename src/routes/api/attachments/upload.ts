import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { attachment } from "#/db/schema";
import {
	ATTACHMENT_MIME_TYPES,
	MAX_ATTACHMENT_BYTES,
} from "#/features/attachments/constants";
import { requireSession } from "#/server/auth/middleware";

const payloadSchema = z.object({ attachmentId: z.uuid() }).strict();

export const Route = createFileRoute("/api/attachments/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = (await request.json()) as HandleUploadBody;
					const result = await handleUpload({
						request,
						body,
						onBeforeGenerateToken: async (pathname, clientPayload) => {
							const origin = request.headers.get("origin");
							if (
								origin &&
								new URL(origin).origin !== new URL(request.url).origin
							)
								throw new Error("Origin check failed");
							const session = await requireSession(request);
							const parsed = payloadSchema.parse(
								JSON.parse(clientPayload ?? "null"),
							);
							const [row] = await db
								.select()
								.from(attachment)
								.where(
									and(
										eq(attachment.id, parsed.attachmentId),
										eq(attachment.ownerUserId, session.user.id),
										eq(attachment.status, "pending"),
									),
								)
								.limit(1);
							if (!row || row.pathname !== pathname)
								throw new Error("Attachment upload is not authorized");
							if (
								!ATTACHMENT_MIME_TYPES.includes(
									row.mimeType as (typeof ATTACHMENT_MIME_TYPES)[number],
								) ||
								row.sizeBytes > MAX_ATTACHMENT_BYTES
							)
								throw new Error("Attachment metadata is invalid");
							return {
								allowedContentTypes: [row.mimeType],
								maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
								validUntil: Date.now() + 5 * 60 * 1000,
								addRandomSuffix: false,
								allowOverwrite: false,
								cacheControlMaxAge: 60,
								tokenPayload: JSON.stringify({
									attachmentId: row.id,
									pathname: row.pathname,
								}),
							};
						},
						onUploadCompleted: async ({ blob, tokenPayload }) => {
							const parsed = z
								.object({ attachmentId: z.uuid(), pathname: z.string() })
								.strict()
								.parse(JSON.parse(tokenPayload ?? "null"));
							if (blob.pathname !== parsed.pathname)
								throw new Error("Attachment callback path is invalid");
							const { finalizeAttachmentById } = await import(
								"#/features/attachments/server"
							);
							await finalizeAttachmentById({
								attachmentId: parsed.attachmentId,
								expectedPathname: parsed.pathname,
							});
						},
					});
					return Response.json(result, {
						headers: { "Cache-Control": "no-store" },
					});
				} catch (error) {
					return Response.json(
						{
							error:
								error instanceof Error
									? error.message
									: "Attachment upload failed",
						},
						{ status: 400, headers: { "Cache-Control": "no-store" } },
					);
				}
			},
		},
	},
});
