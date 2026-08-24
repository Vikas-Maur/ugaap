import "@tanstack/react-start/server-only";

import { del, get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "#/db/index";
import { attachment } from "#/db/schema";
import { MAX_ATTACHMENT_BYTES, type ReadyAttachment } from "./constants";

function detectedMime(bytes: Uint8Array): ReadyAttachment["mimeType"] | null {
	if (
		bytes.length >= 5 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46 &&
		bytes[4] === 0x2d
	)
		return "application/pdf";
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	)
		return "image/png";
	if (
		bytes.length >= 4 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff &&
		bytes.at(-2) === 0xff &&
		bytes.at(-1) === 0xd9
	)
		return "image/jpeg";
	return null;
}

async function readLimited(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const result = await reader.read();
			if (result.done) break;
			length += result.value.byteLength;
			if (length > MAX_ATTACHMENT_BYTES) {
				await reader.cancel();
				throw new Error("Attachment exceeds the 5 MB limit");
			}
			chunks.push(result.value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

function readyResult(row: typeof attachment.$inferSelect): ReadyAttachment {
	return {
		id: row.id,
		fieldId: row.fieldId,
		name: row.originalName,
		mimeType: row.mimeType as ReadyAttachment["mimeType"],
		sizeBytes: row.sizeBytes,
	};
}

export async function finalizeAttachmentById({
	attachmentId,
	ownerUserId,
	expectedPathname,
}: {
	attachmentId: string;
	ownerUserId?: string;
	expectedPathname?: string;
}): Promise<ReadyAttachment> {
	const conditions = [eq(attachment.id, attachmentId)];
	if (ownerUserId) conditions.push(eq(attachment.ownerUserId, ownerUserId));
	const [row] = await db
		.select()
		.from(attachment)
		.where(and(...conditions))
		.limit(1);
	if (!row) throw new Error("Attachment not found");
	if (expectedPathname && row.pathname !== expectedPathname)
		throw new Error("Attachment path does not match the upload token");
	if (row.status === "ready") return readyResult(row);
	if (row.status !== "pending") throw new Error("Attachment upload failed");

	try {
		const result = await get(row.pathname, {
			access: "private",
			useCache: false,
		});
		if (!result || result.statusCode !== 200)
			throw new Error("Uploaded attachment was not found");
		if (result.blob.pathname !== row.pathname)
			throw new Error("Uploaded attachment path is invalid");
		if (result.blob.size !== row.sizeBytes)
			throw new Error("Uploaded attachment size does not match");
		if (result.blob.contentType !== row.mimeType)
			throw new Error("Uploaded attachment type does not match");

		const bytes = await readLimited(result.stream);
		if (bytes.byteLength !== row.sizeBytes)
			throw new Error("Uploaded attachment size does not match");
		if (detectedMime(bytes) !== row.mimeType)
			throw new Error("Attachment contents do not match its file type");
		const checksum = createHash("sha256").update(bytes).digest("hex");
		if (checksum !== row.checksum)
			throw new Error("Attachment checksum does not match");

		const [updated] = await db
			.update(attachment)
			.set({ status: "ready", checksum })
			.where(and(eq(attachment.id, row.id), eq(attachment.status, "pending")))
			.returning();
		if (!updated) {
			const [winner] = await db
				.select()
				.from(attachment)
				.where(eq(attachment.id, row.id))
				.limit(1);
			if (winner?.status === "ready") return readyResult(winner);
			throw new Error("Attachment could not be finalized");
		}
		return readyResult(updated);
	} catch (error) {
		await db
			.update(attachment)
			.set({ status: "failed" })
			.where(and(eq(attachment.id, row.id), eq(attachment.status, "pending")));
		await del(row.pathname).catch(() => undefined);
		throw error;
	}
}
