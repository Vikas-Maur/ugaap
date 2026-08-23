import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { text, useI18n } from "../features/i18n/i18n";

export const Route = createFileRoute("/")({ component: Home });

const foundations = [
	{
		number: "01",
		title: text({ en: "Start with the problem", hi: "समस्या से शुरुआत करें" }),
		body: text({
			en: "Describe what happened in ordinary words. You should not need to understand a department chart first.",
			hi: "जो हुआ उसे सामान्य शब्दों में बताएँ। पहले विभागों की व्यवस्था समझना ज़रूरी नहीं होना चाहिए।",
		}),
	},
	{
		number: "02",
		title: text({ en: "Reach the right office", hi: "सही कार्यालय तक पहुँचें" }),
		body: text({
			en: "The system narrows the authority, category and form while you stay in control of the final choice.",
			hi: "व्यवस्था प्राधिकरण, श्रेणी और फ़ॉर्म चुनने में मदद करती है। अंतिम चुनाव आपके हाथ में रहता है।",
		}),
	},
	{
		number: "03",
		title: text({ en: "Keep one clear record", hi: "एक स्पष्ट रिकॉर्ड रखें" }),
		body: text({
			en: "Drafts, replies, status changes and the closure decision remain together in chronological order.",
			hi: "मसौदे, जवाब, स्थिति में बदलाव और बंद करने का निर्णय समयक्रम में एक साथ रहते हैं।",
		}),
	},
	{
		number: "04",
		title: text({ en: "Make performance visible", hi: "प्रदर्शन को सामने रखें" }),
		body: text({
			en: "Public measures can show where response is improving and where delay still needs attention.",
			hi: "सार्वजनिक आँकड़े दिखा सकते हैं कि जवाब कहाँ बेहतर हो रहा है और देरी कहाँ बनी हुई है।",
		}),
	},
] as const;

const steps = [
	text({ en: "Describe", hi: "बताएँ" }),
	text({ en: "Review", hi: "जाँचें" }),
	text({ en: "File", hi: "दर्ज करें" }),
	text({ en: "Track", hi: "स्थिति देखें" }),
] as const;

function RouteMap() {
	const { text: translate } = useI18n();
	return (
		<div
			className="border-y border-[var(--line-strong)] py-8 sm:py-10"
			aria-hidden="true"
		>
			<div className="grid gap-10 lg:grid-cols-[minmax(230px,0.42fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
				<div>
					<span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--blue-700)]">
						<span className="grid size-6 place-items-center rounded-full bg-[var(--blue-100)] text-[var(--blue-800)]">
							<Check size={14} />
						</span>
						{translate(
							text({ en: "One guided route", hi: "एक निर्देशित रास्ता" }),
						)}
					</span>
					<p className="mt-3 max-w-[380px] text-xl font-semibold leading-snug tracking-[-0.03em] text-[var(--blue-950)] sm:text-2xl">
						{translate(
							text({
								en: "Your issue moves forward without getting lost in the structure.",
								hi: "आपकी समस्या व्यवस्था में उलझे बिना आगे बढ़ती है।",
							}),
						)}
					</p>
				</div>

				<div>
					<div className="relative grid grid-cols-4">
						<div className="absolute left-4 right-4 top-4 h-px bg-[var(--blue-300)]" />
						{steps.map((step, index) => (
							<div
								className="relative grid justify-items-center gap-3"
								key={step.en}
							>
								<span
									className={`grid size-8 place-items-center rounded-full border text-[0.68rem] font-bold ${
										index === 0
											? "border-[var(--blue-700)] bg-[var(--blue-700)] text-white"
											: "border-[var(--blue-300)] bg-white text-[var(--blue-800)]"
									}`}
								>
									{index + 1}
								</span>
								<span className="max-w-20 text-center text-[0.7rem] font-semibold text-[var(--ink-muted)] sm:text-xs">
									{translate(step)}
								</span>
							</div>
						))}
					</div>
					<div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-xs">
						<span className="text-[var(--ink-faint)]">
							{translate(
								text({
									en: "Citizen stays in control",
									hi: "नियंत्रण नागरिक के पास",
								}),
							)}
						</span>
						<span className="font-semibold text-[var(--blue-800)]">
							{translate(
								text({ en: "Review before filing", hi: "दर्ज करने से पहले जाँच" }),
							)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function Home() {
	const { text: translate } = useI18n();

	return (
		<div className="overflow-hidden">
			<section className="relative border-b border-[var(--line)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
				<div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--blue-500),transparent)]" />
				<div className="relative mx-auto w-full max-w-[1320px] px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
					<header className="max-w-[920px]">
						<p className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue-700)]">
							<span className="size-2 rounded-full bg-[var(--blue-600)]" />
							{translate(
								text({
									en: "A simpler public grievance system",
									hi: "एक सरल सार्वजनिक शिकायत व्यवस्था",
								}),
							)}
						</p>
						<h1 className="m-0 max-w-[900px] text-[clamp(2.75rem,4vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--blue-950)]">
							{translate(
								text({
									en: "Say what happened. Find who should act.",
									hi: "बताएँ क्या हुआ। जानें कार्रवाई किसे करनी है।",
								}),
							)}
						</h1>
					</header>

					<div className="mt-12 border-t border-[var(--line-strong)] pt-10 sm:mt-14 sm:pt-12">
						<div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
							<p className="m-0 max-w-[610px] text-[clamp(1.03rem,1.45vw,1.22rem)] leading-[1.7] text-[var(--ink-muted)]">
								{translate(
									text({
										en: "Describe the issue in your own words. UGAAP helps you reach the responsible authority, review the details and keep a traceable record.",
										hi: "समस्या अपने शब्दों में बताएँ। UGAAP सही प्राधिकरण तक पहुँचने, विवरण जाँचने और कार्रवाई का रिकॉर्ड रखने में मदद करता है।",
									}),
								)}
							</p>
							<div className="flex flex-wrap items-center gap-4">
								<Link
									className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-[var(--blue-700)] bg-[var(--blue-700)] px-5 text-sm font-semibold text-white no-underline transition-all hover:border-[var(--blue-900)] hover:bg-[var(--blue-900)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--blue-300)]"
									to="/login"
									search={{ redirect: "/services" }}
								>
									{translate(
										text({
											en: "Sign in to begin",
											hi: "शुरू करने के लिए साइन इन करें",
										}),
									)}
									<ArrowRight size={17} aria-hidden="true" />
								</Link>
								<Link
									className="inline-flex min-h-12 items-center rounded-full px-3 text-sm font-semibold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 hover:text-[var(--blue-950)]"
									to="/"
									hash="how-it-works"
								>
									{translate(
										text({
											en: "See how it works",
											hi: "जानें यह कैसे काम करता है",
										}),
									)}
								</Link>
							</div>
						</div>
						<div className="mt-14 sm:mt-16">
							<RouteMap />
						</div>
					</div>
				</div>
			</section>

			<section
				className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(260px,0.62fr)_minmax(0,1.38fr)] lg:gap-[clamp(64px,9vw,150px)] lg:px-8 lg:py-28"
				id="foundations"
				aria-labelledby="foundations-title"
			>
				<header className="self-start lg:sticky lg:top-28">
					<p className="mb-4 text-sm font-semibold text-[var(--blue-700)]">
						{translate(
							text({
								en: "Built around the citizen",
								hi: "नागरिक को केंद्र में रखकर",
							}),
						)}
					</p>
					<h2
						className="m-0 max-w-[440px] text-[clamp(2.4rem,4.8vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.06em] text-[var(--blue-950)]"
						id="foundations-title"
					>
						{translate(
							text({
								en: "Less hunting. More clarity.",
								hi: "कम खोज। अधिक स्पष्टता।",
							}),
						)}
					</h2>
				</header>
				<div className="border-t border-[var(--line-strong)]">
					{foundations.map((foundation) => (
						<article
							className="grid grid-cols-[42px_1fr] gap-x-5 gap-y-2 border-b border-[var(--line)] py-7 sm:grid-cols-[54px_minmax(180px,0.7fr)_minmax(240px,1fr)] sm:gap-x-7 sm:py-8"
							key={foundation.number}
						>
							<span className="pt-1 text-xs font-bold tabular-nums text-[var(--blue-700)]">
								{foundation.number}
							</span>
							<h3 className="m-0 text-lg font-semibold leading-7 tracking-[-0.02em] text-[var(--ink)]">
								{translate(foundation.title)}
							</h3>
							<p className="col-start-2 m-0 max-w-[590px] leading-7 text-[var(--ink-muted)] sm:col-start-auto">
								{translate(foundation.body)}
							</p>
						</article>
					))}
				</div>
			</section>

			<section
				className="relative overflow-hidden bg-[var(--blue-950)] text-white"
				id="how-it-works"
				aria-labelledby="process-title"
			>
				<div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_80%_20%,#3b82f6,transparent_34rem)]" />
				<div className="relative mx-auto w-full max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="mb-4 text-sm font-semibold text-[var(--blue-300)]">
								{translate(
									text({
										en: "One continuous journey",
										hi: "एक लगातार प्रक्रिया",
									}),
								)}
							</p>
							<h2
								className="m-0 max-w-[680px] text-[clamp(2.4rem,5.3vw,5rem)] font-semibold leading-[0.98] tracking-[-0.06em]"
								id="process-title"
							>
								{translate(
									text({
										en: "From issue to action, without restarting.",
										hi: "समस्या से कार्रवाई तक, बिना दोबारा शुरू किए।",
									}),
								)}
							</h2>
						</div>
						<p className="m-0 max-w-[420px] leading-7 text-[#c7d8f3]">
							{translate(
								text({
									en: "Your account connects the draft, final grievance and every later response.",
									hi: "आपका खाता मसौदे, अंतिम शिकायत और बाद के हर जवाब को जोड़कर रखता है।",
								}),
							)}
						</p>
					</div>

					<ol className="mt-16 grid list-none grid-cols-1 border-t border-white/30 p-0 sm:grid-cols-2 lg:grid-cols-4">
						{steps.map((step, index) => (
							<li
								className="relative border-b border-white/30 py-7 sm:odd:border-r lg:border-b-0 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0"
								key={step.en}
							>
								<span className="text-xs font-bold text-[var(--blue-300)]">
									0{index + 1}
								</span>
								<h3 className="mt-7 text-xl font-semibold">
									{translate(step)}
								</h3>
							</li>
						))}
					</ol>

					<div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-white/30 pt-8 sm:flex-row sm:items-center">
						<p className="m-0 max-w-[510px] text-sm leading-6 text-[#c7d8f3]">
							{translate(
								text({
									en: "Sign in when you are ready to create or resume a grievance.",
									hi: "शिकायत शुरू करने या जारी रखने के लिए तैयार हों, तब साइन इन करें।",
								}),
							)}
						</p>
						<Link
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white bg-white px-5 text-sm font-semibold text-[var(--blue-950)] no-underline transition-colors hover:bg-transparent hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--blue-300)]"
							to="/login"
							search={{ redirect: "/services" }}
						>
							{translate(
								text({ en: "Continue to sign in", hi: "साइन इन पर जाएँ" }),
							)}
							<ArrowRight size={17} aria-hidden="true" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
