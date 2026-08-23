import { realtimeToken } from "@tanstack/ai";
import { geminiRealtimeToken } from "@tanstack/ai-gemini";
import { createFileRoute } from "@tanstack/react-router";
import {
	assertSameOrigin,
	enforceRateLimit,
	privateAiHeaders,
	requestRateLimitKey,
} from "#/server/ai/guard";
import { getSessionFromRequest } from "#/server/auth/middleware";

export const Route = createFileRoute("/api/ai/realtime-token")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				assertSameOrigin(request);
				if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
					return Response.json(
						{ error: "Voice guidance is not configured yet." },
						{ status: 503, headers: privateAiHeaders },
					);
				}
				const session = await getSessionFromRequest(request);
				enforceRateLimit(
					`voice:${requestRateLimitKey(request, session?.user.id)}`,
					session ? 12 : 5,
					5 * 60_000,
				);
				const token = await realtimeToken({
					adapter: geminiRealtimeToken({
						uses: 1,
						expiresAt: Date.now() + 30 * 60_000,
					}),
				});
				return Response.json(token, { headers: privateAiHeaders });
			},
		},
	},
});
