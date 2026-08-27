type SpeechVoice = Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">;

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
