import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { text, useI18n } from "../features/i18n/i18n";
import {
	MINIMUM_CLOSED_CASES,
	MINIMUM_RATINGS,
	SATISFACTION_PRIOR_MEAN,
	SATISFACTION_PRIOR_RATINGS,
} from "../features/leaderboard/scoring";

export const Route = createFileRoute("/methodology")({
	component: MethodologyPage,
});

function MethodologyPage() {
	const { text: translate } = useI18n();
	const components = [
		{
			weight: "30%",
			name: translate(text({ en: "Timely resolution", hi: "समय पर समाधान" })),
			detail: translate(
				text({
					en: "The share of closed cases completed within the 30-day prototype target. Reopened cases reduce this component.",
					hi: "30 दिन के प्रोटोटाइप लक्ष्य के भीतर बंद मामलों का हिस्सा। दोबारा खुले मामले इस अंक को घटाते हैं।",
				}),
			),
		},
		{
			weight: "25%",
			name: translate(text({ en: "Citizen satisfaction", hi: "नागरिक संतुष्टि" })),
			detail: translate(
				text({
					en: `The average 1-to-5 rating, adjusted toward ${SATISFACTION_PRIOR_MEAN.toFixed(1)} stars using a ${SATISFACTION_PRIOR_RATINGS}-rating Bayesian prior.`,
					hi: `औसत 1 से 5 रेटिंग, जिसे ${SATISFACTION_PRIOR_MEAN.toFixed(1)} स्टार और ${SATISFACTION_PRIOR_RATINGS} रेटिंग के बेयज़ियन पूर्व मान से समायोजित किया जाता है।`,
				}),
			),
		},
		{
			weight: "20%",
			name: translate(
				text({ en: "Backlog health", hi: "लंबित मामलों की स्थिति" }),
			),
			detail: translate(
				text({
					en: "The share of open cases that has not crossed the 30-day prototype target. Older unresolved cases reduce the score.",
					hi: "खुले मामलों का वह हिस्सा जिसने 30 दिन का लक्ष्य पार नहीं किया है। पुराने अनसुलझे मामले अंक घटाते हैं।",
				}),
			),
		},
		{
			weight: "15%",
			name: translate(text({ en: "Appeal quality", hi: "अपील गुणवत्ता" })),
			detail: translate(
				text({
					en: "The share of decided appeals that did not overturn the original resolution. A citizen appeal upheld against that resolution reduces the score.",
					hi: "निर्णीत अपीलों का वह हिस्सा जिसमें मूल समाधान नहीं पलटा गया। नागरिक के पक्ष में स्वीकार अपील अंक घटाती है।",
				}),
			),
		},
		{
			weight: "10%",
			name: translate(
				text({ en: "Communication transparency", hi: "संचार पारदर्शिता" }),
			),
			detail: translate(
				text({
					en: "The share of cases with at least one meaningful progress update after submission.",
					hi: "जमा होने के बाद कम से कम एक उपयोगी प्रगति अपडेट वाले मामलों का हिस्सा।",
				}),
			),
		},
	];

	return (
		<main className="page-shell pb-32">
			<header className="border-b border-[var(--line-strong)] pb-8">
				<p className="page-eyebrow">
					{translate(
						text({
							en: "Accountability methodology",
							hi: "जवाबदेही कार्यप्रणाली",
						}),
					)}
				</p>
				<h1 className="page-title">
					{translate(
						text({
							en: "How leaderboard scores are calculated",
							hi: "रैंकिंग अंक कैसे निकाले जाते हैं",
						}),
					)}
				</h1>
				<p className="page-intro max-w-3xl">
					{translate(
						text({
							en: "The formula is fixed, the raw inputs are shown, and organizations with too little evidence do not receive a rank.",
							hi: "सूत्र तय है, मूल आंकड़े दिखाए जाते हैं और कम प्रमाण वाले संगठनों को रैंक नहीं दी जाती।",
						}),
					)}
				</p>
			</header>

			<section className="py-10" aria-labelledby="formula-heading">
				<h2
					id="formula-heading"
					className="text-2xl font-bold text-[var(--blue-950)]"
				>
					{translate(text({ en: "Weighted formula", hi: "भारित सूत्र" }))}
				</h2>
				<div className="mt-5 border-y border-[var(--line-strong)]">
					{components.map((component) => (
						<div
							key={component.name}
							className="grid gap-2 border-t border-[var(--line)] px-2 py-5 first:border-t-0 sm:grid-cols-[5rem_14rem_1fr] sm:gap-5 sm:px-4"
						>
							<p className="text-xl font-extrabold text-[var(--blue-800)]">
								{component.weight}
							</p>
							<h3 className="font-bold text-[var(--blue-950)]">
								{component.name}
							</h3>
							<p className="text-sm leading-6 text-[var(--ink-muted)]">
								{component.detail}
							</p>
						</div>
					))}
				</div>
			</section>

			<section
				className="grid gap-10 border-t border-[var(--line)] py-10 lg:grid-cols-2"
				aria-label="Ranking rules"
			>
				<div>
					<h2 className="text-xl font-bold text-[var(--blue-950)]">
						{translate(
							text({ en: "Eligibility and grades", hi: "पात्रता और ग्रेड" }),
						)}
					</h2>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						{translate(
							text({
								en: `An organization needs ${MINIMUM_CLOSED_CASES} closed cases and ${MINIMUM_RATINGS} ratings in the rolling 90-day window. Below either threshold, the leaderboard shows "Insufficient data".`,
								hi: `90 दिनों में संगठन के पास ${MINIMUM_CLOSED_CASES} बंद मामले और ${MINIMUM_RATINGS} रेटिंग होनी चाहिए। किसी भी सीमा से नीचे "अपर्याप्त डेटा" दिखाया जाता है।`,
							}),
						)}
					</p>
					<dl className="mt-5 grid grid-cols-2 border-y border-[var(--line)] text-sm">
						<GradeRule grade="A" range="80 to 100" />
						<GradeRule grade="B" range="65 to 79.99" />
						<GradeRule grade="C" range="50 to 64.99" />
						<GradeRule grade="D" range="Below 50" />
					</dl>
				</div>
				<div>
					<h2 className="text-xl font-bold text-[var(--blue-950)]">
						{translate(
							text({
								en: "One official case, counted once",
								hi: "एक आधिकारिक मामला, एक बार गिना गया",
							}),
						)}
					</h2>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						{translate(
							text({
								en: "The snapshot reads the official grievance dataset. Private cases and cases with public redacted copies contribute to the same organization totals. Publishing creates a visibility-controlled copy, so it never increases the denominator or gives a case extra weight.",
								hi: "स्नैपशॉट आधिकारिक शिकायत डेटा पढ़ता है। निजी मामले और सार्वजनिक संपादित प्रति वाले मामले एक ही संगठन के कुल में जुड़ते हैं। प्रकाशन केवल दृश्यता नियंत्रित प्रति बनाता है, इसलिए कुल संख्या नहीं बढ़ती।",
							}),
						)}
					</p>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						{translate(
							text({
								en: "Current prototype snapshots are synthetic methodology-demo data. The interface labels them as synthetic and must not be read as claims about real authorities.",
								hi: "वर्तमान प्रोटोटाइप स्नैपशॉट कृत्रिम कार्यप्रणाली डेमो डेटा हैं। इन्हें वास्तविक प्राधिकरणों के प्रदर्शन का दावा न समझें।",
							}),
						)}
					</p>
				</div>
			</section>

			<Link
				className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
				to="/leaderboard"
				search={{ group: "central", compare: "" }}
			>
				{translate(text({ en: "Open the leaderboard", hi: "रैंकिंग खोलें" }))}
				<ArrowRight size={16} aria-hidden="true" />
			</Link>
		</main>
	);
}

function GradeRule({ grade, range }: { grade: string; range: string }) {
	return (
		<div className="border-b border-l border-[var(--line)] p-4 first:border-l-0">
			<dt className="font-extrabold text-[var(--blue-900)]">Grade {grade}</dt>
			<dd className="mt-1 text-[var(--ink-muted)]">{range}</dd>
		</div>
	);
}
