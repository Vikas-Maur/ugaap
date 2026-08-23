const windows = new Map<string, { count: number; resetsAt: number }>();

export function assertSameOrigin(request: Request) {
	const origin = request.headers.get("origin");
	if (origin && new URL(origin).origin !== new URL(request.url).origin) {
		throw new Response("Origin check failed.", { status: 403 });
	}
}

export function enforceRateLimit(
	key: string,
	limit: number,
	windowMs = 60_000,
) {
	const now = Date.now();
	const current = windows.get(key);
	if (!current || current.resetsAt <= now) {
		windows.set(key, { count: 1, resetsAt: now + windowMs });
		return;
	}
	if (current.count >= limit) {
		throw new Response("Too many assistant requests. Please wait a moment.", {
			status: 429,
			headers: {
				"Retry-After": String(Math.ceil((current.resetsAt - now) / 1_000)),
			},
		});
	}
	current.count += 1;
}

export function requestRateLimitKey(request: Request, userId?: string) {
	if (userId) return `user:${userId}`;
	const forwarded = request.headers
		.get("x-forwarded-for")
		?.split(",")[0]
		?.trim();
	return `anon:${forwarded || "unknown"}`;
}

export const privateAiHeaders = {
	"Cache-Control": "private, no-store, max-age=0",
	"X-Content-Type-Options": "nosniff",
};
