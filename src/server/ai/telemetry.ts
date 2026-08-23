import type { ChatMiddleware } from "@tanstack/ai";

export function createAiTelemetry(): ChatMiddleware {
	return {
		name: "ugaap-ai-telemetry",
		onStart: (context) => {
			console.info(
				JSON.stringify({
					event: "ai.start",
					requestId: context.requestId,
					provider: context.provider,
					model: context.model,
				}),
			);
		},
		onUsage: (context, usage) => {
			console.info(
				JSON.stringify({
					event: "ai.usage",
					requestId: context.requestId,
					provider: context.provider,
					model: context.model,
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
				}),
			);
		},
		onFinish: (context, info) => {
			console.info(
				JSON.stringify({
					event: "ai.finish",
					requestId: context.requestId,
					provider: context.provider,
					model: context.model,
					durationMs: info.duration,
					finishReason: info.finishReason,
				}),
			);
		},
		onAbort: (context, info) => {
			console.info(
				JSON.stringify({
					event: "ai.abort",
					requestId: context.requestId,
					provider: context.provider,
					model: context.model,
					durationMs: info.duration,
				}),
			);
		},
		onError: (context, info) => {
			console.error(
				JSON.stringify({
					event: "ai.error",
					requestId: context.requestId,
					provider: context.provider,
					model: context.model,
					durationMs: info.duration,
					errorType:
						info.error instanceof Error ? info.error.name : "UnknownError",
				}),
			);
		},
	};
}
