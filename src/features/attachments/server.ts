import "@tanstack/react-start/server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
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
				throw new Error("Attachment exceeds the 4 MB limit");
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

async function deleteBlobBestEffort(pathname: string) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5_000);
	try {
		await del(pathname, { abortSignal: controller.signal }).catch(
			() => undefined,
		);
	} finally {
		clearTimeout(timeout);
	}
}

export async function storePreparedAttachment({
	attachmentId,
	ownerUserId,
	contentType,
	stream,
}: {
	attachmentId: string;
	ownerUserId: string;
	contentType: string;
	stream: ReadableStream<Uint8Array>;
}): Promise<ReadyAttachment> {
	const [row] = await db
		.select()
		.from(attachment)
		.where(
			and(
				eq(attachment.id, attachmentId),
				eq(attachment.ownerUserId, ownerUserId),
			),
		)
		.limit(1);
	if (!row) throw new Error("Attachment not found");
	if (row.status === "ready") return readyResult(row);
	if (row.status !== "pending") throw new Error("Attachment upload failed");
	if (contentType !== row.mimeType)
		throw new Error("Attachment type does not match");

	try {
		const bytes = await readLimited(stream);
		if (bytes.byteLength !== row.sizeBytes)
			throw new Error("Attachment size does not match");
		if (detectedMime(bytes) !== row.mimeType)
			throw new Error("Attachment contents do not match its file type");
		const checksum = createHash("sha256").update(bytes).digest("hex");
		if (checksum !== row.checksum)
			throw new Error("Attachment checksum does not match");

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 20_000);
		try {
			const blob = await put(row.pathname, Buffer.from(bytes), {
				access: "private",
				abortSignal: controller.signal,
				addRandomSuffix: false,
				allowOverwrite: false,
				cacheControlMaxAge: 60,
				contentType: row.mimeType,
			});
			if (blob.pathname !== row.pathname || blob.contentType !== row.mimeType)
				throw new Error("Stored attachment metadata does not match");
		} finally {
			clearTimeout(timeout);
		}

		const [updated] = await db
			.update(attachment)
			.set({ status: "ready", checksum })
			.where(and(eq(attachment.id, row.id), eq(attachment.status, "pending")))
			.returning();
		if (updated) return readyResult(updated);
		const [winner] = await db
			.select()
			.from(attachment)
			.where(eq(attachment.id, row.id))
			.limit(1);
		if (winner?.status === "ready") return readyResult(winner);
		throw new Error("Attachment could not be finalized");
	} catch (error) {
		await db
			.update(attachment)
			.set({ status: "failed" })
			.where(and(eq(attachment.id, row.id), eq(attachment.status, "pending")));
		await deleteBlobBestEffort(row.pathname);
		throw error;
	}
}
