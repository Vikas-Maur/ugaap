import { chat } from "@tanstack/ai";
import { geminiText } from "@tanstack/ai-gemini";
import { createFileRoute } from "@tanstack/react-router";
import {
	assistantTranscriptionRequestSchema,
	assistantTranscriptionSchema,
} from "#/features/assistant/schema";
import {
	assertSameOrigin,
	enforceRateLimit,
	privateAiHeaders,
	requestRateLimitKey,
} from "#/server/ai/guard";
import { configuredTextModel, hasConfiguredTextModel } from "#/server/ai/model";
import { getSessionFromRequest } from "#/server/auth/middleware";

export const Route = createFileRoute("/api/ai/transcribe")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				assertSameOrigin(request);
				if (!hasConfiguredTextModel()) {
					return Response.json(
						{ error: "Voice transcription is not configured yet." },
						{ status: 503, headers: privateAiHeaders },
					);
				}
				if (Number(request.headers.get("content-length") ?? 0) > 3_000_000) {
					return Response.json(
						{ error: "The recording is too large." },
						{ status: 413, headers: privateAiHeaders },
					);
				}

				let payload: unknown;
				try {
					payload = await request.json();
				} catch {
					return Response.json(
						{ error: "The recording request is not valid JSON." },
						{ status: 400, headers: privateAiHeaders },
					);
				}
				const parsed = assistantTranscriptionRequestSchema.safeParse(payload);
				if (!parsed.success) {
					return Response.json(
						{ error: "The recording request is not valid." },
						{ status: 400, headers: privateAiHeaders },
					);
				}

				const session = await getSessionFromRequest(request);
				enforceRateLimit(
					`transcribe:${requestRateLimitKey(request, session?.user.id)}`,
					session ? 30 : 12,
				);

				const result = await chat({
					adapter: geminiText(configuredTextModel()),
					messages: [
						{
							role: "user",
							content: [
								{
									type: "audio",
									source: {
										type: "data",
										value: parsed.data.audio,
										mimeType: parsed.data.mimeType,
									},
								},
							],
						},
					],
					systemPrompts: [
						"Transcribe the recording faithfully. Do not answer the speaker or translate their words. Return an empty transcript only when there is no intelligible speech. Classify English as en. Classify Hindi and Hinglish as hi. Write Hindi and Hinglish in natural Devanagari while keeping official names, numbers, and identifiers unchanged. Choose the language from the spoken grammar, not the topic or Indian official terms.",
					],
					outputSchema: assistantTranscriptionSchema,
					modelOptions: { temperature: 0, maxOutputTokens: 600 },
				});

				return Response.json(result, { headers: privateAiHeaders });
			},
		},
	},
});
