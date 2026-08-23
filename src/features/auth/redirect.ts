export function sanitizeRedirectPath(value: unknown): string {
	if (typeof value !== "string") return "/";
	if (!value.startsWith("/") || value.startsWith("//")) return "/";
	if (value.includes("\\") || value.includes("\r") || value.includes("\n")) {
		return "/";
	}
	try {
		const parsed = new URL(value, "https://ugaap.invalid");
		for (const key of parsed.searchParams.keys()) {
			if (
				/(?:token|secret|password|credential|authorization|cookie|session|code)/i.test(
					key,
				)
			) {
				return "/";
			}
		}
	} catch {
		return "/";
	}
	return value;
}
