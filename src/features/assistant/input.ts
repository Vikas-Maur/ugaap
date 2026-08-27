export function latestUserInput(messages: Array<Record<string, unknown>>) {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== "user") continue;
		if (typeof message.content === "string")
			return { text: message.content.slice(0, 4_000), hasAudio: false };
		const contentParts = Array.isArray(message.content)
			? message.content
			: Array.isArray(message.parts)
				? message.parts
				: [];
		const text = contentParts
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
		const hasAudio = contentParts.some(
			(part) =>
				typeof part === "object" &&
				part !== null &&
				"type" in part &&
				part.type === "audio",
		);
		return { text: text.slice(0, 4_000), hasAudio };
	}
	return { text: "", hasAudio: false };
}
