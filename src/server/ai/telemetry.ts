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
		onBeforeToolCall: (context, tool) => {
			console.info(
				JSON.stringify({
					event: "ai.tool.start",
					requestId: context.requestId,
					tool: tool.toolName,
				}),
			);
		},
		onAfterToolCall: (context, info) => {
			const resultStatus =
				typeof info.result === "object" &&
				info.result !== null &&
				"status" in info.result &&
				typeof info.result.status === "string"
					? info.result.status
					: undefined;
			console.info(
				JSON.stringify({
					event: "ai.tool.finish",
					requestId: context.requestId,
					tool: info.toolName,
					ok: info.ok,
					durationMs: info.duration,
					resultStatus,
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
