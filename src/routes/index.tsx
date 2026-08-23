import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	FileCheck2,
	Landmark,
	MessageSquareText,
} from "lucide-react";

import { text, useI18n } from "../features/i18n/i18n";

export const Route = createFileRoute("/")({ component: Home });

const journey = [
	{
		icon: MessageSquareText,
		title: text({ en: "Describe the grievance", hi: "शिकायत बताएं" }),
		body: text({
			en: "Explain what happened in your own words. No department knowledge is needed.",
			hi: "जो हुआ उसे अपने शब्दों में बताएं। विभाग की जानकारी होना ज़रूरी नहीं है।",
		}),
	},
	{
		icon: Landmark,
		title: text({ en: "Find the right authority", hi: "सही प्राधिकरण खोजें" }),
		body: text({
			en: "UGAAP helps narrow the responsible authority and the appropriate grievance route.",
			hi: "UGAAP जिम्मेदार प्राधिकरण और सही शिकायत मार्ग खोजने में मदद करता है।",
		}),
	},
	{
		icon: FileCheck2,
		title: text({ en: "Review before filing", hi: "दर्ज करने से पहले जांचें" }),
		body: text({
			en: "Check every detail and attachment before anything is submitted.",
			hi: "कुछ भी जमा होने से पहले हर विवरण और संलग्नक की जांच करें।",
		}),
	},
	{
		icon: CheckCircle2,
		title: text({ en: "Keep one clear record", hi: "एक स्पष्ट रिकॉर्ड रखें" }),
		body: text({
			en: "Drafts, responses, status changes and decisions remain together.",
			hi: "मसौदे, जवाब, स्थिति में बदलाव और निर्णय एक साथ रहते हैं।",
		}),
	},
] as const;

function Home() {
	const { text: translate } = useI18n();

	return (
		<div className="overflow-hidden">
			<section className="relative min-h-[calc(100svh-64px)]">
				<div className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-[1280px] flex-col items-center justify-center px-4 pb-20 pt-14 text-center sm:px-6 sm:pb-24 lg:px-8">
					<p className="mb-5 text-sm font-semibold text-[var(--blue-700)]">
						{translate(
							text({
								en: "Public grievance reporting, simplified",
								hi: "सार्वजनिक शिकायत रिपोर्टिंग, अब सरल",
							}),
						)}
					</p>
					<h1 className="m-0 w-full text-[clamp(1.75rem,6.4vw,5.45rem)] font-medium leading-[0.96] tracking-[-0.065em] text-[var(--blue-950)]">
						<span className="block whitespace-nowrap">
							{translate(
								text({ en: "Report a grievance.", hi: "शिकायत दर्ज करें।" }),
							)}
						</span>
						<span className="block whitespace-nowrap">
							{translate(
								text({
									en: "Reach the right authority.",
									hi: "सही प्राधिकरण तक पहुंचें।",
								}),
							)}
						</span>
					</h1>
					<p className="mt-7 max-w-[660px] text-[clamp(1rem,1.5vw,1.2rem)] leading-8 text-[var(--ink-muted)]">
						{translate(
							text({
								en: "Start by describing what happened. UGAAP guides you from your report to the responsible government authority.",
								hi: "क्या हुआ यह बताकर शुरुआत करें। UGAAP आपकी रिपोर्ट को जिम्मेदार सरकारी प्राधिकरण तक पहुंचाने में मार्गदर्शन करता है।",
							}),
						)}
					</p>
					<div className="h-40" aria-hidden="true" />
				</div>
			</section>

			<section
				id="how-it-works"
				aria-labelledby="journey-heading"
				className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-6 lg:px-8 lg:py-32"
			>
				<header className="mx-auto max-w-[680px] text-center">
					<p className="text-sm font-semibold text-[var(--blue-700)]">
						{translate(text({ en: "How it works", hi: "यह कैसे काम करता है" }))}
					</p>
					<h2
						id="journey-heading"
						className="mt-4 text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1] tracking-[-0.06em] text-[var(--blue-950)]"
					>
						{translate(
							text({
								en: "One clear path from report to resolution.",
								hi: "रिपोर्ट से समाधान तक एक स्पष्ट मार्ग।",
							}),
						)}
					</h2>
				</header>

				<ol className="mt-16 grid list-none gap-12 p-0 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4 lg:gap-10">
					{journey.map((step, index) => {
						const Icon = step.icon;
						return (
							<li key={step.title.en}>
								<div className="flex items-center gap-3">
									<span className="grid size-10 place-items-center rounded-full bg-[var(--blue-50)] text-[var(--blue-700)]">
										<Icon size={19} aria-hidden="true" />
									</span>
									<span className="text-xs font-semibold tabular-nums text-[var(--ink-faint)]">
										0{index + 1}
									</span>
								</div>
								<h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-[var(--blue-950)]">
									{translate(step.title)}
								</h3>
								<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
									{translate(step.body)}
								</p>
							</li>
						);
					})}
				</ol>
			</section>

			<section className="bg-[var(--blue-950)] text-white">
				<div className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.6fr)] lg:items-end lg:px-8 lg:py-24">
					<div>
						<p className="text-sm font-semibold text-[var(--blue-300)]">
							{translate(
								text({
									en: "Built around the citizen",
									hi: "नागरिक को केंद्र में रखकर",
								}),
							)}
						</p>
						<h2 className="mt-4 max-w-[760px] text-[clamp(2.6rem,5vw,4.75rem)] font-medium leading-[1] tracking-[-0.06em]">
							{translate(
								text({
									en: "Your grievance should not get lost in government structure.",
									hi: "आपकी शिकायत सरकारी व्यवस्था में खोनी नहीं चाहिए।",
								}),
							)}
						</h2>
					</div>
					<div>
						<p className="max-w-[440px] leading-7 text-[#c7d8f3]">
							{translate(
								text({
									en: "UGAAP keeps the route understandable, the final choice in your hands and every later response attached to the same record.",
									hi: "UGAAP मार्ग को समझने योग्य रखता है, अंतिम चुनाव आपके हाथ में देता है और बाद के हर जवाब को उसी रिकॉर्ड से जोड़ता है।",
								}),
							)}
						</p>
						<Link
							to="/login"
							search={{ redirect: "/services" }}
							className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--paper)] px-5 text-sm font-semibold text-[var(--blue-950)] no-underline transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--blue-300)]"
						>
							{translate(
								text({
									en: "Sign in to report",
									hi: "रिपोर्ट करने के लिए साइन इन करें",
								}),
							)}
							<ArrowRight size={17} aria-hidden="true" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
