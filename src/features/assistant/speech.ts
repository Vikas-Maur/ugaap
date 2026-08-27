type SpeechVoice = Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">;

const DEFAULT_SPEECH_SEGMENT_LENGTH = 220;

function normalizedLocale(locale: string) {
	return locale.replace("_", "-").toLowerCase();
}

export function selectSpeechVoice<T extends SpeechVoice>(
	voices: ReadonlyArray<T>,
	language: "en" | "hi",
) {
	const preferredLocales =
		language === "hi" ? ["hi-in", "hi"] : ["en-in", "en-gb", "en-us", "en"];
	return (
		[...voices]
			.filter((voice) => normalizedLocale(voice.lang).startsWith(language))
			.sort((left, right) => {
				const score = (voice: T) => {
					const locale = normalizedLocale(voice.lang);
					const localeIndex = preferredLocales.indexOf(locale);
					const name = voice.name.toLowerCase();
					return (
						(localeIndex < 0 ? 0 : 100 - localeIndex * 10) +
						(/natural|neural|google/.test(name) ? 8 : 0) +
						(voice.localService ? 2 : 0)
					);
				};
				return score(right) - score(left);
			})[0] ?? null
	);
}

export function splitSpeechText(
	content: string,
	maximumLength = DEFAULT_SPEECH_SEGMENT_LENGTH,
) {
	const normalized = content.replace(/\s+/g, " ").trim();
	if (!normalized) return [];
	if (maximumLength < 1) return [normalized];

	const segments: Array<string> = [];
	let remaining = normalized;
	while (remaining.length > maximumLength) {
		const window = remaining.slice(0, maximumLength + 1);
		const sentenceEnd = Math.max(
			window.lastIndexOf(". "),
			window.lastIndexOf("! "),
			window.lastIndexOf("? "),
			window.lastIndexOf("। "),
		);
		const wordEnd = window.lastIndexOf(" ");
		const splitAt = sentenceEnd >= 0 ? sentenceEnd + 1 : wordEnd;
		const safeSplit = splitAt > 0 ? splitAt : maximumLength;
		segments.push(remaining.slice(0, safeSplit).trim());
		remaining = remaining.slice(safeSplit).trimStart();
	}
	if (remaining) segments.push(remaining);
	return segments;
}

export function canCompleteVoiceResponse({
	requestSettled,
	approvalPending,
	resuming,
	loading,
}: {
	requestSettled: boolean;
	approvalPending: boolean;
	resuming: boolean;
	loading: boolean;
}) {
	return requestSettled && !approvalPending && !resuming && !loading;
}
