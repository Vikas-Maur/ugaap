import { createHash } from "node:crypto";

export const PUBLIC_REDACTION_VERSION = "p4.1-v1";

const sensitiveFieldPattern =
	/\b(?:personal|name|phone|mobile|email|address|house|street|village|locality|pincode|postal|aadhaar|aadhar|pan|account|ifsc|card|transaction|reference|consumer|customer|meter|application|registration|identifier)\b/i;

const patternRedactions: Array<[RegExp, string]> = [
	[/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL REDACTED]"],
	[/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g, "[PHONE REDACTED]"],
	[
		/\b(?:mr|mrs|ms|dr|shri|smt)\.?\s+[\p{L}]+(?:\s+[\p{L}]+){0,2}\b/giu,
		"[NAME REDACTED]",
	],
	[
		/\b(?:address|house|flat|plot|door)\s*(?:number|no\.?)?\s*[:#-]?\s*[^\n,.]{3,100}/gi,
		"[ADDRESS REDACTED]",
	],
	[/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[IDENTIFIER REDACTED]"],
	[/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[IDENTIFIER REDACTED]"],
	[/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, "[IDENTIFIER REDACTED]"],
	[/\b[1-9]\d{5}\b/g, "[LOCATION REDACTED]"],
	[/\b(?:\d[\s-]?){9,18}\b/g, "[IDENTIFIER REDACTED]"],
];

function escapeRegularExpression(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedKnownValues(values: string[]) {
	return [
		...new Set(
			values.map((value) => value.trim()).filter((value) => value.length >= 3),
		),
	]
		.sort((left, right) => right.length - left.length)
		.slice(0, 100);
}

export function fieldIsPrivate(id: string, label: string) {
	const searchable = `${id.replaceAll(/[_-]+/g, " ")} ${label}`;
	return sensitiveFieldPattern.test(searchable);
}

export function redactPublicText(text: string, knownPrivateValues: string[]) {
	let redacted = text.normalize("NFKC");
	let redactionCount = 0;
	for (const value of normalizedKnownValues(knownPrivateValues)) {
		const pattern = new RegExp(escapeRegularExpression(value), "gi");
		redacted = redacted.replace(pattern, () => {
			redactionCount += 1;
			return "[PRIVATE DETAIL REDACTED]";
		});
	}
	for (const [pattern, replacement] of patternRedactions) {
		redacted = redacted.replace(pattern, () => {
			redactionCount += 1;
			return replacement;
		});
	}
	return {
		text: redacted
			.replace(/[ \t]+/g, " ")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
		redactionCount,
	};
}

export function normalizeBroadLocation(
	value: string | undefined,
	knownPrivateValues: string[],
) {
	const location = value?.normalize("NFKC").replace(/\s+/g, " ").trim();
	if (!location) return null;
	const result = redactPublicText(location, knownPrivateValues);
	if (result.redactionCount > 0)
		throw new Error(
			"Use only a broad district, state, or region without an address or identifier",
		);
	return result.text;
}

export function publicationContentHash(input: {
	grievanceId: string;
	sourceReviewHash: string;
	summary: string;
	categoryPath: string[];
	organizationId: string;
	broadLocation: string | null;
}) {
	return createHash("sha256")
		.update(
			JSON.stringify({
				...input,
				redactionVersion: PUBLIC_REDACTION_VERSION,
			}),
		)
		.digest("hex");
}
