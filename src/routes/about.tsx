import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { useI18n } from "../features/i18n/i18n";

export const Route = createFileRoute("/about")({ component: About });

const principles = [
	{
		number: "01",
		title: { en: "Start with the problem", hi: "समस्या से शुरुआत" },
		body: {
			en: "People should not need to understand a government organisation chart before they can ask for help. UGAAP starts with the issue, then helps identify the right authority and form.",
			hi: "मदद माँगने से पहले लोगों को सरकारी विभागों की पूरी संरचना समझने की ज़रूरत नहीं होनी चाहिए। UGAAP समस्या से शुरू करता है, फिर सही प्राधिकरण और फ़ॉर्म खोजने में मदद करता है।",
		},
	},
	{
		number: "02",
		title: { en: "Make every step fast", hi: "हर कदम तेज़ बनाएँ" },
		body: {
			en: "Good UX here means fewer wrong turns, plain-language guidance, quick forms and one place for every update. The product is designed to reduce the time lost before and after a grievance is filed.",
			hi: "यहाँ अच्छा अनुभव कम गलत रास्तों, सरल भाषा में मार्गदर्शन, तेज़ फ़ॉर्म और हर अपडेट के लिए एक जगह का मतलब है। उत्पाद को शिकायत दर्ज होने से पहले और बाद में लगने वाला समय कम करने के लिए बनाया गया है।",
		},
	},
	{
		number: "03",
		title: { en: "Keep the case moving", hi: "मामले को आगे बढ़ाएँ" },
		body: {
			en: "Filing is only the beginning. Citizens can follow the case timeline, see questions from the authority, reply without losing context and stay with the grievance through resolution or appeal.",
			hi: "शिकायत दर्ज करना केवल शुरुआत है। नागरिक मामले की समयरेखा देख सकते हैं, प्राधिकरण के सवाल पढ़ सकते हैं, संदर्भ खोए बिना जवाब दे सकते हैं और समाधान या अपील तक शिकायत के साथ बने रह सकते हैं।",
		},
	},
	{
		number: "04",
		title: { en: "Build accountability in", hi: "जवाबदेही को शामिल करें" },
		body: {
			en: "Accountability packs are part of the product. They turn case records into clear evidence about response times, outcomes and recurring gaps, while public copies stay optional and privacy-safe.",
			hi: "जवाबदेही पैक उत्पाद का हिस्सा हैं। वे मामलों के रिकॉर्ड को प्रतिक्रिया समय, नतीजों और बार-बार आने वाली कमियों के स्पष्ट प्रमाण में बदलते हैं। सार्वजनिक प्रतियाँ वैकल्पिक रहती हैं और निजता की रक्षा करती हैं।",
		},
	},
] as const;

function About() {
	const { text } = useI18n();

	return (
		<main className="overflow-hidden bg-[var(--paper)]">
			<section className="border-b-2 border-[var(--line-strong)] bg-[var(--cream)]">
				<div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.55fr)] lg:items-end lg:px-10 lg:py-28">
					<div>
						<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--action)]">
							{text({ en: "About UGAAP", hi: "UGAAP के बारे में" })}
						</p>
						<h1 className="mt-5 max-w-[900px] text-[clamp(2.75rem,7vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[var(--ink)]">
							{text({
								en: "Universal Grievance and Accountability Platform.",
								hi: "सार्वभौमिक शिकायत और जवाबदेही मंच।",
							})}
						</h1>
					</div>
					<div className="border-t-2 border-[var(--line-strong)] pt-6 lg:border-l-2 lg:border-t-0 lg:pl-9 lg:pt-0">
						<p className="text-lg leading-8 text-[var(--ink)]">
							{text({
								en: "UGAAP is built around a simple standard: filing a public grievance should be fast, clear and easy to follow until the issue is resolved.",
								hi: "UGAAP एक सरल मानक पर बनाया गया है: सार्वजनिक शिकायत दर्ज करना तेज़, स्पष्ट और समाधान तक आसानी से समझ आने वाला होना चाहिए।",
							})}
						</p>
					</div>
				</div>
			</section>

			<section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-7 lg:px-10 lg:py-24">
				<header className="grid gap-5 border-b-2 border-[var(--ink)] pb-8 lg:grid-cols-[0.5fr_1fr] lg:items-end">
					<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--action)]">
						{text({ en: "The product intent", hi: "उत्पाद का उद्देश्य" })}
					</p>
					<h2 className="max-w-[820px] text-[clamp(2.25rem,4.6vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[var(--ink)]">
						{text({
							en: "A grievance service people can actually use, and authorities can be measured against.",
							hi: "ऐसी शिकायत सेवा जिसे लोग सच में इस्तेमाल कर सकें और जिसमें प्राधिकरणों की जवाबदेही मापी जा सके।",
						})}
					</h2>
				</header>

				<ol className="m-0 list-none p-0">
					{principles.map((principle) => (
						<li
							key={principle.number}
							className="grid gap-4 border-b border-[var(--line-strong)] py-8 sm:grid-cols-[4rem_minmax(150px,0.5fr)_minmax(0,1fr)] sm:gap-7 lg:grid-cols-[5rem_minmax(230px,0.55fr)_minmax(0,1fr)] lg:gap-12 lg:py-10"
						>
							<span className="text-sm font-extrabold tabular-nums text-[var(--terracotta)]">
								{principle.number}
							</span>
							<h3 className="text-xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
								{text(principle.title)}
							</h3>
							<p className="m-0 max-w-[700px] leading-7 text-[var(--ink-muted)]">
								{text(principle.body)}
							</p>
						</li>
					))}
				</ol>
			</section>

			<section className="border-y-2 border-[var(--ink)] bg-[var(--action)] text-[var(--primary-foreground)]">
				<div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 py-12 sm:px-7 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-16">
					<div>
						<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--highlight-soft)]">
							{text({ en: "One connected record", hi: "एक जुड़ा हुआ रिकॉर्ड" })}
						</p>
						<p className="mt-4 max-w-[760px] text-[clamp(1.7rem,3vw,2.7rem)] font-semibold leading-tight tracking-[-0.035em]">
							{text({
								en: "File faster. See every response. Carry the evidence into accountability.",
								hi: "तेज़ी से दर्ज करें। हर जवाब देखें। प्रमाण को जवाबदेही तक ले जाएँ।",
							})}
						</p>
					</div>
					<Link
						to="/login"
						search={{ redirect: "/services" }}
						className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border-2 border-[var(--primary-foreground)] px-5 text-sm font-bold text-[var(--primary-foreground)] no-underline transition-colors hover:bg-[var(--primary-foreground)] hover:text-[var(--action)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--highlight)]"
					>
						{text({ en: "Raise a grievance", hi: "शिकायत दर्ज करें" })}
						<ArrowRight size={18} aria-hidden="true" />
					</Link>
				</div>
			</section>
		</main>
	);
}
