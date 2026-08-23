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
			<main className="page-shell max-w-3xl">
				<h1 className="page-title mt-0">
					{text({ en: "Nothing is waiting", hi: "कोई काम लंबित नहीं है" })}
				</h1>
				<button
					type="button"
					onClick={() => void navigate({ to: "/" })}
					className="action-primary mt-6"
				>
					{text({ en: "Go to home", hi: "होम पर जाएँ" })}
				</button>
			</main>
		);
	}

	return (
		<main className="page-shell max-w-3xl">
			<p className="page-eyebrow">
				{text({ en: "Your saved request", hi: "आपका सुरक्षित अनुरोध" })}
			</p>
			<h1 className="page-title">{intent.title}</h1>
			{intent.summary ? (
				<p className="mt-4 max-w-2xl whitespace-pre-wrap text-base leading-7 text-slate-700">
					{intent.summary}
				</p>
			) : null}
			<p className="mt-6 max-w-2xl rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-600">
				{text({
					en: "Continue only if this is the request you want to resume.",
					hi: "आगे तभी बढ़ें जब आप इसी अनुरोध को फिर से शुरू करना चाहते हों।",
				})}
			</p>
			<div className="mt-8 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={continueIntent}
					className="action-primary"
				>
					{text({ en: "Continue", hi: "जारी रखें" })}
				</button>
				<button type="button" onClick={discard} className="action-secondary">
					{text({ en: "Discard", hi: "हटाएँ" })}
				</button>
			</div>
		</main>
	);
}
