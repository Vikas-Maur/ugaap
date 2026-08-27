import {
	chat,
	chatParamsFromRequestBody,
	mergeAgentTools,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { geminiText } from "@tanstack/ai-gemini";
import { createFileRoute } from "@tanstack/react-router";
import { latestUserInput } from "#/features/assistant/input";
import {
	buildAssistantPrompt,
	detectMessageLanguage,
} from "#/features/assistant/prompt";
import {
	assistantChatRequestSchema,
	assistantTurnSchema,
} from "#/features/assistant/schema";
import { searchCatalogueServer } from "#/features/assistant/server-catalogue";
import { searchGrievanceCatalogueDef } from "#/features/assistant/tools";
import {
	assertSameOrigin,
	enforceRateLimit,
	privateAiHeaders,
	requestRateLimitKey,
} from "#/server/ai/guard";
import { configuredTextModel, hasConfiguredTextModel } from "#/server/ai/model";
import { createAiTelemetry } from "#/server/ai/telemetry";
import { getSessionFromRequest } from "#/server/auth/middleware";

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
				if (Number(request.headers.get("content-length") ?? 0) > 4_000_000) {
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
				let agentParams: Awaited<ReturnType<typeof chatParamsFromRequestBody>>;
				try {
					agentParams = await chatParamsFromRequestBody(payload);
				} catch {
					return Response.json(
						{ error: "Assistant request does not follow the chat protocol." },
						{ status: 400, headers: privateAiHeaders },
					);
				}

				const session = await getSessionFromRequest(request);
				enforceRateLimit(
					requestRateLimitKey(request, session?.user.id),
					session ? 30 : 12,
				);
				const latestInput = latestUserInput(parsed.data.messages);
				if (!latestInput.text && !latestInput.hasAudio) {
					return Response.json(
						{ error: "Write or record a message first." },
						{ status: 400, headers: privateAiHeaders },
					);
				}

				const origin = new URL(request.url).origin;
				const searchTool = searchGrievanceCatalogueDef.server(
					async (searchRequest) => {
						const result = await searchCatalogueServer(origin, searchRequest);
						return {
							...result,
							results: result.results.map((hit) => ({
								id: hit.id,
								authoritySlug: hit.authoritySlug,
								authorityName: hit.authorityName,
								categoryId: hit.categoryId,
								title: hit.title,
								categoryPath: hit.categoryPath,
							})),
							status: result.results.length
								? ("found" as const)
								: ("not-found" as const),
							catalogueOnly: true as const,
						};
					},
				);
				const tools = mergeAgentTools([searchTool], agentParams.tools);
				const abortController = new AbortController();
				const stream = chat({
					adapter: geminiText(configuredTextModel()),
					messages: agentParams.messages,
					systemPrompts: [
						buildAssistantPrompt({
							replyLanguage:
								parsed.data.forwardedProps.messageLanguage ??
								(latestInput.hasAudio
									? "auto"
									: detectMessageLanguage(latestInput.text)),
							latestInputHasAudio: latestInput.hasAudio,
							authenticated: Boolean(session),
							pathname: parsed.data.forwardedProps.pathname,
							route: parsed.data.forwardedProps.route,
							currentForm: parsed.data.forwardedProps.currentForm,
							pageContent: parsed.data.forwardedProps.pageContent,
						}),
					],
					outputSchema: assistantTurnSchema,
					tools,
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
