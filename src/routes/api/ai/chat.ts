import {
	chat,
	type ModelMessage,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { geminiText } from "@tanstack/ai-gemini";
import { createFileRoute } from "@tanstack/react-router";

import {
	buildAssistantPrompt,
	detectMessageLanguage,
} from "#/features/assistant/prompt";
import {
	assistantChatRequestSchema,
	assistantTurnSchema,
} from "#/features/assistant/schema";
import { findAssistantCandidates } from "#/features/assistant/server-catalogue";
import {
	assertSameOrigin,
	enforceRateLimit,
	privateAiHeaders,
	requestRateLimitKey,
} from "#/server/ai/guard";
import { createAiTelemetry } from "#/server/ai/telemetry";
import { configuredTextModel, hasConfiguredTextModel } from "#/server/ai/model";
import { getSessionFromRequest } from "#/server/auth/middleware";

function latestUserText(messages: Array<Record<string, unknown>>) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "user") continue;
		if (typeof message.content === "string")
			return message.content.slice(0, 4_000);
		if (!Array.isArray(message.parts)) continue;
		const text = message.parts
			.flatMap((part) =>
				typeof part === "object" &&
				part !== null &&
				"type" in part &&
				part.type === "text" &&
				"content" in part &&
				typeof part.content === "string"
					? [part.content]
					: [],
			)
			.join(" ")
			.trim();
		if (text) return text.slice(0, 4_000);
	}
	return "";
}

function textFromParts(parts: unknown) {
	if (!Array.isArray(parts)) return "";
	return parts
		.flatMap((part) => {
			if (typeof part !== "object" || part === null || !("type" in part))
				return [];
			if (
				part.type === "text" &&
				"content" in part &&
				typeof part.content === "string"
			)
				return [part.content];
			if (part.type === "structured-output" && "data" in part && part.data)
				return [JSON.stringify(part.data)];
			return [];
		})
		.join(" ")
		.slice(0, 6_000);
}

function modelMessages(
	messages: Array<Record<string, unknown>>,
): ModelMessage[] {
	return messages.flatMap((message) => {
		if (message.role !== "user" && message.role !== "assistant") return [];
		const content =
			typeof message.content === "string"
				? message.content
				: textFromParts(message.parts);
		if (!content.trim()) return [];
		return [{ role: message.role, content: content.slice(0, 6_000) }];
	});
}

export const Route = createFileRoute("/api/ai/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				assertSameOrigin(request);
				if (!hasConfiguredTextModel()) {
					return Response.json(
						{ error: "The assistant is not configured yet." },
						{ status: 503, headers: privateAiHeaders },
					);
				}
				const contentLength = Number(
					request.headers.get("content-length") ?? 0,
				);
				if (contentLength > 160_000) {
					return Response.json(
						{ error: "Assistant request is too large." },
						{ status: 413, headers: privateAiHeaders },
					);
				}
				let payload: unknown;
				try {
					payload = await request.json();
				} catch {
					return Response.json(
						{ error: "Assistant request is not valid JSON." },
						{ status: 400, headers: privateAiHeaders },
					);
				}
				const parsed = assistantChatRequestSchema.safeParse(payload);
				if (!parsed.success) {
					return Response.json(
						{ error: "Assistant request is not valid." },
						{ status: 400, headers: privateAiHeaders },
					);
				}

				const session = await getSessionFromRequest(request);
				enforceRateLimit(
					requestRateLimitKey(request, session?.user.id),
					session ? 30 : 12,
				);
				const userText = latestUserText(parsed.data.messages);
				if (!userText) {
					return Response.json(
						{ error: "Write a message first." },
						{ status: 400, headers: privateAiHeaders },
					);
				}
				const candidates = await findAssistantCandidates(
					new URL(request.url).origin,
					userText,
					12,
				);
				const candidateById = new Map(
					candidates.map((candidate) => [candidate.formId, candidate]),
				);
				const currentFieldById = new Map(
					parsed.data.forwardedProps.currentForm?.fields.map((field) => [
						field.id,
						field,
					]) ?? [],
				);
				const constrainedTurnSchema = assistantTurnSchema.superRefine(
					(turn, context) => {
						if (turn.formId === null) {
							if (turn.authoritySlug !== null)
								context.addIssue({
									code: "custom",
									path: ["authoritySlug"],
									message: "Authority must be null without a form.",
								});
							if (turn.formTitle !== null || turn.authorityName !== null)
								context.addIssue({
									code: "custom",
									path: ["formTitle"],
									message: "Route labels must be null without a form.",
								});
						} else {
							const candidate = candidateById.get(turn.formId);
							if (
								!candidate ||
								candidate.authoritySlug !== turn.authoritySlug ||
								candidate.title !== turn.formTitle ||
								candidate.authorityName !== turn.authorityName
							) {
								context.addIssue({
									code: "custom",
									path: ["formId"],
									message:
										"Form must be selected from the catalogue candidates.",
								});
							}
						}
						for (const extracted of turn.extractedFields) {
							const field = currentFieldById.get(extracted.fieldId);
							if (!field || field.kind === "file") {
								context.addIssue({
									code: "custom",
									path: ["extractedFields"],
									message:
										"Extracted field is not available on the current form.",
								});
								continue;
							}
							if (
								field.options?.length &&
								!field.options.includes(extracted.value)
							) {
								context.addIssue({
									code: "custom",
									path: ["extractedFields"],
									message: "Select value must match an available option.",
								});
							}
						}
					},
				);
				const abortController = new AbortController();
				const stream = chat({
					adapter: geminiText(configuredTextModel()),
					messages: modelMessages(parsed.data.messages),
					systemPrompts: [
						buildAssistantPrompt({
							replyLanguage: detectMessageLanguage(userText),
							authenticated: Boolean(session),
							pathname: parsed.data.forwardedProps.pathname,
							candidates,
							currentForm: parsed.data.forwardedProps.currentForm,
							pageContent: parsed.data.forwardedProps.pageContent,
						}),
					],
					outputSchema: constrainedTurnSchema,
					stream: true,
					abortController,
					modelOptions: { temperature: 0.2, maxOutputTokens: 1_200 },
					middleware: [createAiTelemetry()],
				});
				const response = toServerSentEventsResponse(stream, {
					abortController,
				});
				for (const [name, value] of Object.entries(privateAiHeaders))
					response.headers.set(name, value);
				return response;
			},
		},
	},
});
