import { get } from "@vercel/blob";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { attachment } from "#/db/schema";
import { requireSession } from "#/server/auth/middleware";

function contentDisposition(name: string) {
	const ascii = name
		.replace(/[^\x20-\x7e]/g, "_")
		.replace(/["\\]/g, "_")
		.slice(0, 180);
	return `attachment; filename="${ascii || "attachment"}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const Route = createFileRoute("/api/attachments/$attachmentId")({
	server: {
		handlers: {
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
				const headers = {
					"Cache-Control": "private, no-cache",
					"Content-Disposition": contentDisposition(row.originalName),
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
