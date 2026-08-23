import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight } from "lucide-react";

import { text, useI18n } from "../features/i18n/i18n";

export const Route = createFileRoute("/")({ component: Home });

const foundations = [
	{
		number: "01",
		title: text({ en: "One entry point", hi: "एक प्रवेश बिंदु" }),
		body: text({
			en: "Begin with the issue, not a department chart or a long list of forms.",
			hi: "विभागों की सूची या कई फ़ॉर्म से नहीं, अपनी समस्या से शुरुआत करें।",
		}),
	},
	{
		number: "02",
		title: text({ en: "Responsible authority", hi: "उत्तरदायी प्राधिकरण" }),
		body: text({
			en: "Route each grievance to the office responsible for acting on it.",
			hi: "हर शिकायत उस कार्यालय तक पहुँचे जो उस पर कार्रवाई के लिए उत्तरदायी है।",
		}),
	},
	{
		number: "03",
		title: text({ en: "Traceable record", hi: "पता लगाने योग्य रिकॉर्ड" }),
		body: text({
			en: "Keep the grievance, responses and closure decision in one clear history.",
			hi: "शिकायत, जवाब और बंद करने का निर्णय एक स्पष्ट क्रम में रखें।",
		}),
	},
	{
		number: "04",
		title: text({ en: "Public accountability", hi: "सार्वजनिक जवाबदेही" }),
		body: text({
			en: "Make performance visible so that delay and improvement can both be examined.",
			hi: "प्रदर्शन को सामने रखें, ताकि देरी और सुधार दोनों की जाँच हो सके।",
		}),
	},
] as const;

const steps = [
	{
		number: "01",
		title: text({ en: "Sign in securely", hi: "सुरक्षित रूप से साइन इन करें" }),
		body: text({
			en: "Your account keeps drafts and grievance activity connected to you.",
			hi: "आपका खाता मसौदों और शिकायत की गतिविधि को आपसे जोड़कर रखता है।",
		}),
	},
	{
		number: "02",
		title: text({ en: "Describe what happened", hi: "बताएँ कि क्या हुआ" }),
		body: text({
			en: "Use ordinary words. The system helps narrow down the authority and form.",
			hi: "सामान्य शब्दों में लिखें। व्यवस्था सही प्राधिकरण और फ़ॉर्म चुनने में मदद करती है।",
		}),
	},
	{
		number: "03",
		title: text({ en: "Review before filing", hi: "दर्ज करने से पहले जाँचें" }),
		body: text({
			en: "Check the destination, details and attachments before the grievance moves forward.",
			hi: "शिकायत आगे बढ़ने से पहले प्राधिकरण, विवरण और संलग्नक जाँचें।",
		}),
	},
] as const;

function Home() {
	const { text: translate } = useI18n();

	return (
		<div className="overflow-hidden">
			<section
				className="mx-auto grid min-h-[690px] w-full max-w-[1240px] grid-cols-1 gap-0 border-b border-[var(--line-strong)] px-4 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:gap-[clamp(48px,7vw,110px)] lg:px-0"
				aria-labelledby="home-title"
			>
				<div className="flex min-h-[570px] max-w-[750px] flex-col justify-center py-[62px] lg:min-h-0 lg:py-20 lg:pb-[62px]">
					<p className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] leading-[1.4] text-[var(--blue-700)]">
						{translate(
							text({
								en: "Universal grievance and accountability platform",
								hi: "सार्वभौमिक शिकायत और जवाबदेही मंच",
							}),
						)}
					</p>
					<h1
						className="m-0 max-w-[760px] text-[clamp(3rem,14vw,4.8rem)] font-semibold leading-[0.94] tracking-[-0.068em] text-[var(--blue-950)] sm:text-[clamp(3.3rem,6.3vw,6.35rem)]"
						id="home-title"
					>
						{translate(
							text({
								en: "A grievance system built around the citizen.",
								hi: "नागरिक को केंद्र में रखकर बनी शिकायत व्यवस्था।",
							}),
						)}
					</h1>
					<p className="mt-7 max-w-[650px] text-[clamp(1rem,1.35vw,1.16rem)] leading-[1.72] text-[var(--ink-muted)] lg:mt-[30px]">
						{translate(
							text({
								en: "Describe the problem in your own words. UGAAP helps find the responsible authority, preserves a clear record and makes performance easier to examine.",
								hi: "अपनी समस्या अपने शब्दों में बताएँ। UGAAP उत्तरदायी प्राधिकरण खोजने, स्पष्ट रिकॉर्ड रखने और प्रदर्शन की जाँच आसान बनाने में मदद करता है।",
							}),
						)}
					</p>
					<div className="mt-[34px] flex flex-wrap items-center gap-6">
						<Link
							className="inline-flex min-h-[46px] items-center justify-center gap-2.5 border border-[var(--blue-800)] bg-[var(--blue-800)] px-[18px] text-[0.86rem] font-bold text-white no-underline transition-colors hover:border-[var(--blue-950)] hover:bg-[var(--blue-950)]"
							to="/login"
							search={{ redirect: "/services" }}
						>
							{translate(
								text({ en: "Sign in to begin", hi: "शुरू करने के लिए साइन इन करें" }),
							)}
							<ArrowRight size={18} aria-hidden="true" />
						</Link>
						<Link
							className="text-[0.86rem] font-bold text-[var(--blue-800)] underline decoration-[var(--blue-300)] underline-offset-4 hover:text-[var(--blue-950)] hover:decoration-current"
							to="/register"
							search={{ redirect: "/services" }}
						>
							{translate(text({ en: "Create an account", hi: "खाता बनाएँ" }))}
						</Link>
					</div>
					<Link
						className="mt-auto inline-flex w-fit items-center gap-2 pt-14 text-[0.76rem] font-bold text-[var(--ink-faint)] no-underline hover:text-[var(--blue-800)]"
						to="/"
						hash="foundations"
					>
						<ArrowDown size={17} aria-hidden="true" />
						{translate(text({ en: "See the foundations", hi: "आधार देखें" }))}
					</Link>
				</div>

				<section
					className="grid min-h-[470px] grid-cols-2 grid-rows-4 border-x border-t border-[var(--line-strong)] bg-linear-to-br from-[rgba(220,234,255,0.8)] to-[rgba(255,255,255,0.35)] lg:min-h-full lg:border-t-0"
					aria-label={translate(
						text({ en: "System foundations", hi: "व्यवस्था के आधार" }),
					)}
				>
					<div className="col-start-1 row-span-2 flex min-w-0 flex-col justify-between border-b border-[var(--line-strong)] bg-[var(--blue-950)] p-[17px] text-white sm:p-[22px]">
						<span className="text-[0.7rem] font-extrabold tracking-[0.14em]">
							01
						</span>
						<strong className="max-w-[160px] text-[clamp(1rem,1.45vw,1.3rem)] leading-[1.18]">
							{translate(foundations[0].title)}
						</strong>
					</div>
					<div className="col-start-2 row-start-2 row-span-2 flex min-w-0 flex-col justify-between border-b border-l border-[var(--line-strong)] bg-[var(--blue-300)] p-[17px] text-[var(--blue-950)] sm:p-[22px]">
						<span className="text-[0.7rem] font-extrabold tracking-[0.14em]">
							02
						</span>
						<strong className="max-w-[160px] text-[clamp(1rem,1.45vw,1.3rem)] leading-[1.18]">
							{translate(foundations[1].title)}
						</strong>
					</div>
					<div className="col-start-1 row-start-3 row-span-2 flex min-w-0 flex-col justify-between border-b border-[var(--line-strong)] bg-[var(--blue-700)] p-[17px] text-white sm:p-[22px]">
						<span className="text-[0.7rem] font-extrabold tracking-[0.14em]">
							03
						</span>
						<strong className="max-w-[160px] text-[clamp(1rem,1.45vw,1.3rem)] leading-[1.18]">
							{translate(foundations[2].title)}
						</strong>
					</div>
					<div className="col-start-2 row-start-4 flex min-w-0 flex-col justify-between border-b border-l border-[var(--line-strong)] bg-white p-[17px] text-[var(--blue-950)] sm:p-[22px]">
						<span className="text-[0.7rem] font-extrabold tracking-[0.14em]">
							04
						</span>
						<strong className="max-w-[160px] text-[clamp(1rem,1.45vw,1.3rem)] leading-[1.18]">
							{translate(foundations[3].title)}
						</strong>
					</div>
				</section>
			</section>

			<section
				className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-12 px-4 py-[78px] sm:px-6 lg:grid-cols-[minmax(260px,0.56fr)_minmax(0,1.44fr)] lg:gap-[clamp(50px,8vw,130px)] lg:px-0 lg:py-[104px] lg:pb-[116px]"
				id="foundations"
				aria-labelledby="foundations-title"
			>
				<header className="self-start">
					<p className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] leading-[1.4] text-[var(--blue-700)]">
						{translate(text({ en: "The foundations", hi: "व्यवस्था के आधार" }))}
					</p>
					<h2
						className="m-0 max-w-[430px] text-[clamp(2.15rem,4vw,4rem)] font-semibold leading-none tracking-[-0.055em] text-[var(--blue-950)]"
						id="foundations-title"
					>
						{translate(
							text({
								en: "Each part supports the next.",
								hi: "हर भाग अगले भाग को सहारा देता है।",
							}),
						)}
					</h2>
				</header>
				<div className="border-t border-[var(--line-strong)]">
					{foundations.map((foundation) => (
						<article
							className="grid min-h-[144px] grid-cols-[44px_1fr] items-start gap-4 border-b border-[var(--line-strong)] py-7 sm:grid-cols-[58px_minmax(170px,0.65fr)_minmax(220px,1fr)] sm:gap-6"
							key={foundation.number}
						>
							<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
								{foundation.number}
							</span>
							<h3 className="m-0 text-[1.12rem] leading-[1.3] text-[var(--ink)]">
								{translate(foundation.title)}
							</h3>
							<p className="col-start-2 m-0 leading-[1.68] text-[var(--ink-muted)] sm:col-start-auto">
								{translate(foundation.body)}
							</p>
						</article>
					))}
				</div>
			</section>

			<section
				className="grid grid-cols-1 gap-[54px] bg-linear-to-br from-[var(--blue-950)] via-[#0a3679] to-[#0d4b9e] px-4 py-[76px] text-white sm:px-6 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)] lg:gap-[clamp(50px,8vw,130px)] lg:px-[max(24px,calc((100vw-1240px)/2))] lg:py-[100px] lg:pb-[108px]"
				id="how-it-works"
				aria-labelledby="process-title"
			>
				<header className="self-start">
					<p className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] leading-[1.4] text-[var(--blue-300)]">
						{translate(text({ en: "How it works", hi: "यह कैसे काम करता है" }))}
					</p>
					<h2
						className="m-0 max-w-[430px] text-[clamp(2.15rem,4vw,4rem)] font-semibold leading-none tracking-[-0.055em] text-white"
						id="process-title"
					>
						{translate(
							text({
								en: "A shorter path from issue to action.",
								hi: "समस्या से कार्रवाई तक छोटा रास्ता।",
							}),
						)}
					</h2>
				</header>
				<div className="border-t border-white/40">
					{steps.map((step) => (
						<div
							className="grid grid-cols-[44px_1fr] gap-5 border-b border-white/40 py-7 pb-[30px] sm:grid-cols-[58px_1fr]"
							key={step.number}
						>
							<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-300)]">
								{step.number}
							</span>
							<div>
								<h3 className="m-0 text-[1.12rem]">{translate(step.title)}</h3>
								<p className="m-0 mt-2 max-w-[550px] leading-[1.65] text-[#cbdcf4]">
									{translate(step.body)}
								</p>
							</div>
						</div>
					))}
				</div>
				<div className="flex flex-col items-start gap-7 pt-3.5 lg:col-start-2 lg:flex-row lg:items-center lg:justify-between">
					<p className="m-0 max-w-[430px] text-[0.86rem] text-[#cbdcf4]">
						{translate(
							text({
								en: "Your grievance workspace becomes available after sign-in.",
								hi: "साइन इन करने के बाद आपका शिकायत कार्यस्थल उपलब्ध होगा।",
							}),
						)}
					</p>
					<Link
						className="inline-flex min-h-[46px] items-center justify-center gap-2.5 border border-white bg-white px-[18px] text-[0.86rem] font-bold text-[var(--blue-950)] no-underline transition-colors hover:bg-transparent hover:text-white"
						to="/login"
						search={{ redirect: "/services" }}
					>
						{translate(
							text({ en: "Continue to sign in", hi: "साइन इन पर जाएँ" }),
						)}
						<ArrowRight size={18} aria-hidden="true" />
					</Link>
				</div>
			</section>
		</div>
	);
}
