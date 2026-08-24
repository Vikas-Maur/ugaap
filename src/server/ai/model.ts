const supportedTextModels = [
	"gemini-3.5-flash-lite",
	"gemini-3-flash-preview",
	"gemini-2.5-flash-lite",
] as const;

export function configuredTextModel(): (typeof supportedTextModels)[number] {
	const configured = process.env.AI_TEXT_MODEL;
	return (
		supportedTextModels.find((model) => model === configured) ??
		"gemini-3.5-flash-lite"
	);
}

export function hasConfiguredTextModel() {
	return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
