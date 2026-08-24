import "@tanstack/react-start/server-only";

import { createHash } from "node:crypto";
import type { formDefinition } from "#/db/schema";

type CanonicalJson =
	| null
	| boolean
	| number
	| string
	| CanonicalJson[]
	| { [key: string]: CanonicalJson };

function canonicalize(value: unknown): CanonicalJson {
	if (value === null) return null;
	if (typeof value === "string") return value.normalize("NFKC");
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (Array.isArray(value)) return value.map(canonicalize);
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.map(([key, child]) => [key.normalize("NFKC"), child] as const)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, child]) => [key, canonicalize(child)]),
		);
	}
	return String(value).normalize("NFKC");
}

export function computeReviewHash(input: {
	form: typeof formDefinition.$inferSelect;
	language: string;
	answers: Record<string, unknown>;
	remarks: string | null;
	attachmentMetadata: Array<Record<string, unknown>>;
	publicConsent: "not_set" | "opted_in" | "opted_out";
	aiConfidence: string | number | null;
}) {
	const payload = canonicalize({
		form: {
			id: input.form.id,
			formKey: input.form.formKey,
			version: input.form.version,
			checksum: input.form.checksum,
		},
		language: input.language.trim().toLowerCase(),
		answers: input.answers,
		remarks: input.remarks?.trim() ?? "",
		attachmentMetadata: input.attachmentMetadata,
		publicConsent: input.publicConsent,
		aiConfidence: input.aiConfidence,
	});
	return createHash("sha256")
		.update(JSON.stringify(payload), "utf8")
		.digest("hex");
}
