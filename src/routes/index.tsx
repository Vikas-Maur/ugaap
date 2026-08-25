import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowRight,
	Check,
	FileCheck2,
	Landmark,
	MessageSquareText,
	ShieldCheck,
} from "lucide-react";

import { text, useI18n } from "../features/i18n/i18n";

export const Route = createFileRoute("/")({ component: Home });

const journey = [
	{
		icon: MessageSquareText,
		title: text({ en: "Describe the issue", hi: "समस्या बताएं" }),
		body: text({
			en: "Write or speak in everyday words. You do not need to know the department name.",
			hi: "साधारण शब्दों में लिखें या बोलें। विभाग का नाम जानना ज़रूरी नहीं है।",
		}),
	},
	{
		icon: FileCheck2,
		title: text({ en: "File with guidance", hi: "मार्गदर्शन के साथ दर्ज करें" }),
		body: text({
			en: "UGAAP helps you choose the grievance type, complete the form and check every detail.",
			hi: "UGAAP शिकायत का प्रकार चुनने, फ़ॉर्म भरने और हर विवरण जाँचने में आपकी मदद करता है।",
		}),
	},
	{
		icon: Landmark,
		title: text({ en: "Follow the action", hi: "कार्रवाई पर नज़र रखें" }),
		body: text({
			en: "See status changes, authority questions and replies together. Respond when needed.",
			hi: "स्थिति में बदलाव, विभाग के सवाल और जवाब एक साथ देखें। ज़रूरत होने पर उत्तर दें।",
		}),
	},
	{
		icon: Check,
		title: text({ en: "Reach resolution", hi: "समाधान तक पहुँचें" }),
		body: text({
			en: "Keep the case moving until the authority records its decision and the grievance is resolved.",
			hi: "विभाग के निर्णय दर्ज करने और शिकायत के समाधान तक मामले को आगे बढ़ाते रहें।",
		}),
	},
] as const;

function Home() {
	const { text: translate } = useI18n();

	return (
		<div className="overflow-hidden">
			<section className="relative border-b-2 border-[var(--line-strong)] bg-[var(--cream)]">
				<div className="relative z-10 mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-[1440px] items-start gap-12 px-5 pb-44 pt-12 sm:px-7 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.65fr)] lg:items-center lg:gap-20 lg:px-10 lg:pb-36 lg:pt-14">
					<div className="max-w-[680px]">
						<p className="page-eyebrow">
							{translate(
								text({
									en: "Public grievances, followed through",
									hi: "सार्वजनिक शिकायत, समाधान तक साथ",
								}),
							)}
						</p>
						<h1 className="mt-5 text-[clamp(2.6rem,11vw,3.5rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-[var(--ink)] sm:text-[clamp(3rem,5.1vw,4.75rem)]">
							<span className="block">
								{translate(
									text({
										en: "Raise your grievance.",
										hi: "अपनी शिकायत उठाएं।",
									}),
								)}
							</span>
							<span className="block">
								{translate(
									text({ en: "Get it resolved.", hi: "उसका समाधान पाएं।" }),
								)}
							</span>
						</h1>
						<p className="mt-7 max-w-[610px] text-lg leading-8 text-[var(--ink-muted)]">
							{translate(
								text({
									en: "UGAAP helps you file the right grievance, follow every response and keep the case moving until it is resolved.",
									hi: "UGAAP सही शिकायत दर्ज करने, हर जवाब पर नज़र रखने और समाधान तक मामले को आगे बढ़ाने में आपकी मदद करता है।",
								}),
							)}
						</p>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<Link
								to="/login"
								search={{ redirect: "/services" }}
								className="action-primary no-underline"
							>
								{translate(
									text({ en: "Raise a grievance", hi: "शिकायत दर्ज करें" }),
								)}
								<ArrowRight size={18} aria-hidden="true" />
							</Link>
							<Link
								to="/"
								hash="how-it-works"
								className="action-secondary no-underline"
							>
								{translate(
									text({
										en: "See how UGAAP helps",
										hi: "देखें UGAAP कैसे मदद करता है",
									}),
								)}
								<ArrowDown size={18} aria-hidden="true" />
							</Link>
						</div>
					</div>

					<div className="w-full max-w-[520px] lg:justify-self-end">
						<p className="page-eyebrow">
							{translate(
								text({ en: "How UGAAP helps", hi: "UGAAP कैसे मदद करता है" }),
							)}
						</p>
						<ol className="m-0 mt-5 list-none border-y-2 border-[var(--ink)] p-0">
							{journey.map((step, index) => (
								<li
									key={step.title.en}
									className="grid min-h-16 grid-cols-[3.25rem_1fr] items-center gap-4 border-b border-[var(--line-strong)] py-4 last:border-b-0"
								>
									<span className="text-sm font-extrabold tabular-nums text-[var(--terracotta)]">
										0{index + 1}
									</span>
									<span className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
										{translate(step.title)}
									</span>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			<section
				id="how-it-works"
				aria-labelledby="journey-heading"
				className="bg-[var(--paper)]"
			>
				<div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-7 lg:px-10 lg:py-28">
					<header className="grid gap-6 border-b-2 border-[var(--ink)] pb-9 lg:grid-cols-[0.45fr_1fr] lg:items-end">
						<p className="page-eyebrow">
							{translate(
								text({
									en: "What UGAAP helps you do",
									hi: "UGAAP आपकी कैसे मदद करता है",
								}),
							)}
						</p>
						<h2
							id="journey-heading"
							className="max-w-[760px] text-[clamp(2.5rem,4.5vw,4.9rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[var(--ink)]"
						>
							{translate(
								text({
									en: "From first report to final resolution.",
									hi: "पहली शिकायत से अंतिम समाधान तक।",
								}),
							)}
						</h2>
					</header>

					<ol className="m-0 grid list-none p-0 lg:grid-cols-4">
						{journey.map((step, index) => {
							const Icon = step.icon;
							return (
								<li
									key={step.title.en}
									className="border-b border-[var(--line-strong)] py-8 lg:border-b-0 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
								>
									<div className="flex items-center justify-between gap-4">
										<span className="grid size-12 place-items-center rounded-full bg-[var(--highlight)] text-[var(--ink)]">
											<Icon size={21} aria-hidden="true" />
										</span>
										<span className="text-sm font-extrabold tabular-nums text-[var(--action)]">
											0{index + 1}
										</span>
									</div>
									<h3 className="mt-6 text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
										{translate(step.title)}
									</h3>
									<p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
										{translate(step.body)}
									</p>
								</li>
							);
						})}
					</ol>
				</div>
			</section>

			<section className="border-y-2 border-[var(--ink)] bg-[var(--highlight)] text-[var(--ink)]">
				<div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 py-16 sm:px-7 lg:grid-cols-[1fr_0.8fr] lg:items-end lg:px-10 lg:py-20">
					<div>
						<ShieldCheck size={38} strokeWidth={1.8} aria-hidden="true" />
						<h2 className="mt-6 max-w-[760px] text-[clamp(2.7rem,5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.06em]">
							{translate(
								text({
									en: "You stay in control of what gets sent.",
									hi: "क्या भेजा जाए, इसका नियंत्रण आपके हाथ में रहता है।",
								}),
							)}
						</h2>
					</div>
					<div className="border-t-2 border-[var(--ink)] pt-6 lg:border-l-2 lg:border-t-0 lg:pl-9 lg:pt-0">
						<p className="max-w-[500px] text-lg leading-8">
							{translate(
								text({
									en: "UGAAP helps you prepare and file a grievance, keep every reply together and follow the case through resolution. It cannot submit anything by itself. You always approve the final form.",
									hi: "UGAAP शिकायत तैयार और दर्ज करने, हर जवाब को एक साथ रखने और समाधान तक मामले पर नज़र रखने में मदद करता है। यह अपने आप कुछ भी जमा नहीं कर सकता। अंतिम फ़ॉर्म की मंज़ूरी हमेशा आप देते हैं।",
								}),
							)}
						</p>
						<Link
							to="/about"
							className="mt-7 inline-flex min-h-12 items-center gap-2 border-b-2 border-[var(--ink)] text-sm font-extrabold text-[var(--ink)] no-underline"
						>
							{translate(
								text({
									en: "Read what UGAAP does",
									hi: "जानें UGAAP क्या करता है",
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
