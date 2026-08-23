import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "#/features/i18n/i18n";
import {
	clearPendingIntent,
	type PendingIntent,
	readPendingIntent,
	sanitizeRedirectPath,
} from "#/features/intent";

export const Route = createFileRoute("/_authenticated/continuation")({
	component: ContinuationScreen,
});

function ContinuationScreen() {
	const { text } = useI18n();
	const navigate = useNavigate();
	const [intent, setIntent] = useState<PendingIntent | null>(null);

	useEffect(() => {
		setIntent(readPendingIntent());
	}, []);

	function discard() {
		clearPendingIntent();
		setIntent(null);
	}

	function continueIntent() {
		if (!intent) return;
		const destination = sanitizeRedirectPath(intent.returnTo);
		clearPendingIntent();
		if (destination === "/") {
			void navigate({ to: "/" });
			return;
		}
		void navigate({ href: destination });
	}

	if (!intent) {
		return (
			<main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
				<h1 className="text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
					{text({ en: "Nothing is waiting", hi: "कोई काम लंबित नहीं है" })}
				</h1>
				<button
					type="button"
					onClick={() => void navigate({ to: "/" })}
					className="mt-6 inline-flex min-h-11 items-center justify-center border border-blue-900 bg-blue-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
				>
					{text({ en: "Go to home", hi: "होम पर जाएँ" })}
				</button>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
			<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
				{text({ en: "Your saved request", hi: "आपका सुरक्षित अनुरोध" })}
			</p>
			<h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
				{intent.title}
			</h1>
			{intent.summary ? (
				<p className="mt-4 max-w-2xl whitespace-pre-wrap text-base leading-7 text-slate-700">
					{intent.summary}
				</p>
			) : null}
			<p className="mt-6 border-l-4 border-blue-700 pl-4 text-sm leading-6 text-slate-600">
				{text({
					en: "Continue only if this is the request you want to resume.",
					hi: "आगे तभी बढ़ें जब आप इसी अनुरोध को फिर से शुरू करना चाहते हों।",
				})}
			</p>
			<div className="mt-8 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={continueIntent}
					className="inline-flex min-h-11 items-center justify-center border border-blue-900 bg-blue-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
				>
					{text({ en: "Continue", hi: "जारी रखें" })}
				</button>
				<button
					type="button"
					onClick={discard}
					className="inline-flex min-h-11 items-center justify-center border border-blue-700 bg-white px-5 py-2.5 font-semibold text-blue-900 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
				>
					{text({ en: "Discard", hi: "हटाएँ" })}
				</button>
			</div>
		</main>
	);
}
