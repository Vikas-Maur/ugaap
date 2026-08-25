import { createFileRoute } from "@tanstack/react-router";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { attachment } from "#/db/schema";
import { MAX_ATTACHMENT_BYTES } from "#/features/attachments/constants";
import { requireSession } from "#/server/auth/middleware";

function contentDisposition(
	name: string,
	disposition: "attachment" | "inline" = "attachment",
) {
	const ascii = name
		.replace(/[^\x20-\x7e]/g, "_")
		.replace(/["\\]/g, "_")
		.slice(0, 180);
	return `${disposition}; filename="${ascii || "attachment"}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function uploadFailure(error: unknown) {
	const message = error instanceof Error ? error.message : "";
	if (/cannot use private access on a public store/i.test(message))
		return {
			message: "Secure attachment storage is not configured",
			status: 503,
		};
	if (/aborted|timed out/i.test(message))
		return {
			message: "Attachment storage did not respond in time",
			status: 503,
		};
	return {
		message: message || "Attachment upload failed",
		status: 400,
	};
}

export const Route = createFileRoute("/api/attachments/$attachmentId")({
	server: {
		handlers: {
			PUT: async ({ request, params }) => {
				const session = await requireSession(request).catch(() => null);
				if (!session)
					return Response.json(
						{ error: "Unauthorized" },
						{ status: 401, headers: { "Cache-Control": "no-store" } },
					);
				const origin = request.headers.get("origin");
				if (origin && new URL(origin).origin !== new URL(request.url).origin)
					return Response.json(
						{ error: "Origin check failed" },
						{ status: 403, headers: { "Cache-Control": "no-store" } },
					);
				if (!request.body)
					return Response.json(
						{ error: "Attachment body is required" },
						{ status: 400, headers: { "Cache-Control": "no-store" } },
					);
				const contentLength = request.headers.get("content-length");
				if (contentLength) {
					const size = Number(contentLength);
					if (
						!Number.isSafeInteger(size) ||
						size <= 0 ||
						size > MAX_ATTACHMENT_BYTES
					)
						return Response.json(
							{ error: "Attachment size is invalid" },
							{ status: 413, headers: { "Cache-Control": "no-store" } },
						);
				}
				try {
					const { storePreparedAttachment } = await import(
						"#/features/attachments/server"
					);
					const ready = await storePreparedAttachment({
						attachmentId: params.attachmentId,
						ownerUserId: session.user.id,
						contentType: request.headers.get("content-type") ?? "",
						stream: request.body,
					});
					return Response.json(ready, {
						headers: { "Cache-Control": "no-store" },
					});
				} catch (error) {
					const failure = uploadFailure(error);
					return Response.json(
						{ error: failure.message },
						{
							status: failure.status,
							headers: { "Cache-Control": "no-store" },
						},
					);
				}
			},
			GET: async ({ request, params }) => {
				const session = await requireSession(request).catch(() => null);
				if (!session)
					return new Response("Unauthorized", {
						status: 401,
						headers: { "Cache-Control": "no-store" },
					});
				const [row] = await db
					.select()
					.from(attachment)
					.where(
						and(
							eq(attachment.id, params.attachmentId),
							eq(attachment.ownerUserId, session.user.id),
							eq(attachment.status, "ready"),
						),
					)
					.limit(1);
				if (!row)
					return new Response("Not found", {
						status: 404,
						headers: { "Cache-Control": "no-store" },
					});
				const result = await get(row.pathname, {
					access: "private",
					ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
				});
				if (!result)
					return new Response("Not found", {
						status: 404,
						headers: { "Cache-Control": "no-store" },
					});
				const preview =
					new URL(request.url).searchParams.get("preview") === "1";
				const headers = {
					"Cache-Control": "private, no-cache",
					"Content-Disposition": contentDisposition(
						row.originalName,
						preview ? "inline" : "attachment",
					),
					"X-Content-Type-Options": "nosniff",
					Vary: "Cookie, Authorization",
					ETag: result.blob.etag,
				};
				if (result.statusCode === 304)
					return new Response(null, { status: 304, headers });
				return new Response(result.stream, {
					headers: { ...headers, "Content-Type": row.mimeType },
				});
			},
		},
	},
});
