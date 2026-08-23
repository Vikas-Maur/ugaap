import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FileCheck2, FileClock, Globe2, LogOut, Scale } from "lucide-react";
import type { ReactNode } from "react";

import { text, useI18n } from "../features/i18n/i18n";
import { authClient } from "../lib/auth-client";
import { AssistantComposer } from "./AssistantComposer";
import { BrandLogo } from "./BrandLogo";

const workspacePrefixes = ["/services", "/drafts", "/continuation"];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isWorkspace = workspacePrefixes.some((prefix) =>
		pathname.startsWith(prefix),
	);

	return isWorkspace ? (
		<WorkspaceShell>{children}</WorkspaceShell>
	) : (
		<PublicShell>{children}</PublicShell>
	);
}

function LanguageControl() {
	const { language, toggleLanguage, text: translate } = useI18n();

	return (
		<button
			className="inline-flex min-h-9 items-center gap-1.5 border-0 bg-transparent p-0 text-[0.76rem] font-bold text-[var(--ink-muted)] transition-colors hover:text-[var(--blue-700)]"
			type="button"
			onClick={toggleLanguage}
			aria-label={translate(text({ en: "Switch language", hi: "भाषा बदलें" }))}
		>
			<Globe2 size={16} aria-hidden="true" />
			<span
				className={
					language === "en"
						? "text-[var(--blue-800)] underline decoration-[var(--blue-300)] underline-offset-4"
						: ""
				}
			>
				EN
			</span>
			<span aria-hidden="true">/</span>
			<span
				className={
					language === "hi"
						? "text-[var(--blue-800)] underline decoration-[var(--blue-300)] underline-offset-4"
						: ""
				}
			>
				हिं
			</span>
		</button>
	);
}

function PublicShell({ children }: Readonly<{ children: ReactNode }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();

	return (
		<div className="min-h-screen bg-[linear-gradient(118deg,_rgba(220,234,255,0.42)_0%,_rgba(248,251,255,0)_34rem),_var(--paper)]">
			<header className="relative z-10 border-b border-[var(--line)] bg-[rgba(248,251,255,0.92)] backdrop-blur-xl">
				<div className="mx-auto grid min-h-[78px] w-full max-w-[1240px] grid-cols-[auto_1fr_auto] items-center gap-[clamp(30px,5vw,76px)] px-4 sm:px-6 lg:px-0">
					<Link
						className="inline-flex text-inherit no-underline"
						to="/"
						aria-label="UGAAP home"
					>
						<BrandLogo />
					</Link>
					<nav
						className="hidden items-center gap-[clamp(20px,3vw,38px)] lg:flex"
						aria-label={translate(
							text({ en: "Public navigation", hi: "सार्वजनिक नेविगेशन" }),
						)}
					>
						<Link
							className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline transition-colors hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
							to="/about"
						>
							{translate(text({ en: "About", hi: "परिचय" }))}
						</Link>
						<Link
							className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline transition-colors hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
							to="/"
							hash="how-it-works"
						>
							{translate(text({ en: "How it works", hi: "यह कैसे काम करता है" }))}
						</Link>
						<Link
							className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline transition-colors hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
							to="/privacy"
						>
							{translate(text({ en: "Privacy", hi: "गोपनीयता" }))}
						</Link>
					</nav>
					<div className="flex items-center gap-3 sm:gap-6">
						<LanguageControl />
						<Link
							className="min-h-9 border border-[var(--blue-800)] bg-[var(--blue-800)] px-2.5 py-2 text-[0.8rem] font-bold text-white no-underline transition-colors hover:border-[var(--blue-950)] hover:bg-[var(--blue-950)] sm:px-3.5"
							to={session?.user ? "/services" : "/login"}
							search={session?.user ? { q: "" } : { redirect: "/services" }}
						>
							{session?.user
								? translate(text({ en: "Open workspace", hi: "कार्यस्थल खोलें" }))
								: translate(text({ en: "Sign in", hi: "साइन इन" }))}
						</Link>
					</div>
				</div>
			</header>

			<main className="min-h-[calc(100vh-265px)]">{children}</main>

			<footer className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 border-t border-[var(--line-strong)] px-4 py-9 pb-12 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10 lg:px-0">
				<div className="flex flex-col items-start gap-3.5 sm:flex-row sm:items-center sm:gap-6">
					<BrandLogo />
					<p className="m-0 max-w-[430px] text-[0.8rem] text-[var(--ink-muted)]">
						{translate(
							text({
								en: "One route into the grievance system. A clear record of what follows.",
								hi: "शिकायत व्यवस्था तक एक रास्ता। आगे की कार्रवाई का स्पष्ट रिकॉर्ड।",
							}),
						)}
					</p>
				</div>
				<nav
					className="flex items-center gap-6"
					aria-label={translate(
						text({ en: "Legal information", hi: "कानूनी जानकारी" }),
					)}
				>
					<Link
						className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
						to="/terms"
					>
						{translate(text({ en: "Terms", hi: "नियम" }))}
					</Link>
					<Link
						className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
						to="/privacy"
					>
						{translate(text({ en: "Privacy", hi: "गोपनीयता" }))}
					</Link>
					<Link
						className="text-[0.82rem] font-semibold text-[var(--ink-muted)] no-underline hover:text-[var(--blue-800)] hover:underline hover:underline-offset-4"
						to="/cookies"
					>
						{translate(text({ en: "Cookies", hi: "कुकीज़" }))}
					</Link>
				</nav>
			</footer>
		</div>
	);
}

function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();

	async function signOut() {
		await authClient.signOut();
		await navigate({ to: "/" });
	}

	return (
		<div className="min-h-screen bg-white md:grid md:grid-cols-[224px_minmax(0,1fr)]">
			<aside className="relative flex flex-col bg-[var(--blue-950)] px-4 pt-2 text-white md:sticky md:top-0 md:h-screen md:border-r md:border-[var(--blue-950)] md:px-0 md:py-[18px]">
				<Link
					className="mb-2 flex items-center gap-3 font-extrabold tracking-[0.12em] text-white no-underline md:mx-[22px] md:mb-[26px]"
					to="/"
				>
					<BrandLogo compact />
					<span>UGAAP</span>
				</Link>
				<nav
					className="flex overflow-x-auto border-t border-white/30 md:grid md:overflow-visible"
					aria-label={translate(
						text({ en: "Grievance workspace", hi: "शिकायत कार्यस्थल" }),
					)}
				>
					<Link
						className="flex min-h-[54px] flex-1 shrink-0 items-center gap-3 border-r border-white/30 px-[22px] text-[0.84rem] font-semibold text-[#c8d9f2] no-underline transition-colors hover:bg-[#8dbbff29] hover:text-white md:border-r-0 md:border-b"
						to="/services"
						search={{ q: "" }}
						activeProps={{ className: "bg-[#8dbbff29] text-white" }}
					>
						<FileCheck2 size={19} aria-hidden="true" />
						<span>
							{translate(text({ en: "New grievance", hi: "नई शिकायत" }))}
						</span>
					</Link>
					<Link
						className="flex min-h-[54px] flex-1 shrink-0 items-center gap-3 border-r border-white/30 px-[22px] text-[0.84rem] font-semibold text-[#c8d9f2] no-underline transition-colors hover:bg-[#8dbbff29] hover:text-white md:border-r-0 md:border-b"
						to="/drafts"
						activeProps={{ className: "bg-[#8dbbff29] text-white" }}
					>
						<FileClock size={19} aria-hidden="true" />
						<span>{translate(text({ en: "Drafts", hi: "मसौदे" }))}</span>
					</Link>
				</nav>
				<div className="absolute right-4 top-[14px] grid gap-2.5 md:static md:mx-[22px] md:mt-auto md:border-t md:border-white/30 md:px-0 md:pt-5">
					<span className="hidden max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.76rem] text-[#c8d9f2] md:block">
						{session?.user.name ||
							session?.user.email ||
							translate(text({ en: "Citizen", hi: "नागरिक" }))}
					</span>
					<button
						className="flex items-center gap-2 border-0 bg-transparent p-0 text-[0.8rem] font-bold text-white"
						type="button"
						onClick={() => void signOut()}
					>
						<LogOut size={17} aria-hidden="true" />
						<span className="hidden md:inline">
							{translate(text({ en: "Sign out", hi: "साइन आउट" }))}
						</span>
					</button>
				</div>
			</aside>

			<div className="min-w-0">
				<header className="flex min-h-[58px] items-center justify-between gap-5 border-b border-[var(--line-strong)] px-4 md:min-h-[66px] md:px-[clamp(24px,4vw,54px)]">
					<div className="flex items-center gap-2 text-[0.8rem] font-bold text-[var(--ink-muted)]">
						<Scale size={18} aria-hidden="true" />
						<span>
							{translate(
								text({ en: "Grievance workspace", hi: "शिकायत कार्यस्थल" }),
							)}
						</span>
					</div>
					<LanguageControl />
				</header>
				<main className="mx-auto w-[calc(100%_-_28px)] max-w-[1080px] py-[26px] pb-20 md:w-[calc(100%_-_48px)] md:py-9">
					<AssistantComposer />
					{children}
				</main>
			</div>
		</div>
	);
}
