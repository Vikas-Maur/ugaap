import { z } from "zod";

/**
 * Anonymous recovery data is intentionally small and contains no credentials,
 * cookies, bearer tokens, or raw provider responses.
 */
export const pendingIntentSchema = z
	.object({
		version: z.literal(1),
		kind: z.enum(["grievance", "agent-thread"]),
		title: z.string().trim().min(1).max(240),
		summary: z.string().trim().max(4000).default(""),
		formKey: z.string().trim().min(1).max(240).optional(),
		formVersion: z.number().int().positive().max(100_000).optional(),
		language: z.enum(["en", "hi"]).default("en"),
		threadId: z.string().trim().min(1).max(240).optional(),
		answers: z
			.record(
				z
					.string()
					.refine(
						(key) =>
							!/(?:token|secret|password|credential|authorization|cookie|session|api[-_]?key)/i.test(
								key,
							),
						{
							message: "Sensitive fields cannot be stored in anonymous intent",
						},
					),
				z.string().max(2000),
			)
			.default({}),
		returnTo: z.string().trim().max(500).optional(),
	})
	.strict();

export type PendingIntent = z.infer<typeof pendingIntentSchema>;

export const PENDING_INTENT_STORAGE_KEY = "ugaap.pending-intent.v1";

function getStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

export function savePendingIntent(intent: PendingIntent): boolean {
	const storage = getStorage();
	if (!storage) return false;
	const parsed = pendingIntentSchema.safeParse(intent);
	if (!parsed.success) return false;
	try {
		storage.setItem(PENDING_INTENT_STORAGE_KEY, JSON.stringify(parsed.data));
		return true;
	} catch {
		return false;
	}
}

export function readPendingIntent(): PendingIntent | null {
	const storage = getStorage();
	if (!storage) return null;
	try {
		const value = storage.getItem(PENDING_INTENT_STORAGE_KEY);
		if (!value) return null;
		const parsed = pendingIntentSchema.safeParse(JSON.parse(value));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function clearPendingIntent(): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.removeItem(PENDING_INTENT_STORAGE_KEY);
	} catch {
		// Storage can be disabled by the browser. There is nothing to clear.
	}
}

export function hasPendingIntent(): boolean {
	return readPendingIntent() !== null;
}
