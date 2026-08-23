import { Bot, LoaderCircle, Mic } from "lucide-react";
import { lazy, Suspense } from "react";

import { text, useI18n } from "#/features/i18n/i18n";

const AssistantLauncher = lazy(() =>
	import("./AssistantLauncher").then((module) => ({
		default: module.AssistantLauncher,
	})),
);

export function AssistantEntry() {
	const { text: translate } = useI18n();

	return (
		<Suspense
			fallback={
				<div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex min-h-20 max-w-3xl items-center gap-3 border border-blue-300 bg-white px-4 shadow-[0_18px_55px_rgba(15,59,138,0.2)] sm:inset-x-6 sm:bottom-5">
					<Bot
						className="shrink-0 text-blue-800"
						size={21}
						aria-hidden="true"
					/>
					<div className="min-w-0 flex-1">
						<p className="m-0 text-sm font-semibold text-blue-950">
							{translate(text({ en: "Ask UGAAP", hi: "UGAAP से पूछें" }))}
						</p>
						<p className="m-0 mt-1 truncate text-xs text-slate-500">
							{translate(
								text({
									en: "Loading text and voice controls…",
									hi: "टेक्स्ट और आवाज़ नियंत्रण लोड हो रहे हैं…",
								}),
							)}
						</p>
					</div>
					<Mic className="text-blue-700" size={18} aria-hidden="true" />
					<LoaderCircle
						className="animate-spin text-blue-700"
						size={18}
						aria-hidden="true"
					/>
				</div>
			}
		>
			<AssistantLauncher />
		</Suspense>
	);
}
