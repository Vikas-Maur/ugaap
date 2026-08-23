import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FileClock, FilePlus2, Globe2, Home, LogOut, Menu } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { text, useI18n } from "../features/i18n/i18n";
import { authClient } from "../lib/auth-client";
import { AssistantEntry } from "./AssistantEntry";
import { BrandLogo } from "./BrandLogo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "./ui/sidebar";

const workspacePrefixes = ["/services", "/drafts", "/continuation"];

function useHeaderScrolled() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const update = () => setScrolled(window.scrollY > 8);
		const frame = requestAnimationFrame(update);
		window.addEventListener("scroll", update, { passive: true });

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", update);
		};
	}, []);

	return scrolled;
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isWorkspace = workspacePrefixes.some((prefix) =>
		pathname.startsWith(prefix),
	);

	return (
		<>
			<div className="route-view">
				{isWorkspace ? (
					<WorkspaceShell pathname={pathname}>{children}</WorkspaceShell>
				) : (
					<PublicShell home={pathname === "/"}>{children}</PublicShell>
				)}
			</div>
			<AssistantEntry home={pathname === "/"} />
		</>
	);
}

function LanguageControl({ inverse = false }: { inverse?: boolean }) {
	const { language, toggleLanguage, text: translate } = useI18n();

	return (
		<button
			className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-300)] ${
				inverse
					? "border-white/35 text-white hover:bg-white/10"
					: "border-transparent bg-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:bg-[var(--paper)] hover:text-[var(--blue-800)]"
			}`}
			type="button"
			onClick={toggleLanguage}
			aria-label={translate(text({ en: "Switch language", hi: "भाषा बदलें" }))}
		>
			<Globe2 size={15} aria-hidden="true" />
			<span className="sm:hidden">{language === "en" ? "EN" : "हिं"}</span>
			<span
				className={`${language === "en" ? "font-extrabold" : "opacity-60"} hidden sm:inline`}
			>
				EN
			</span>
			<span aria-hidden="true" className="hidden opacity-40 sm:inline">
				/
			</span>
			<span
				className={`${language === "hi" ? "font-extrabold" : "opacity-60"} hidden sm:inline`}
			>
				हिं
			</span>
		</button>
	);
}

const publicLinkClass =
	"text-sm font-medium text-[var(--ink-muted)] no-underline transition-colors hover:text-[var(--blue-800)] focus-visible:rounded-sm focus-visible:outline-3 focus-visible:outline-[var(--blue-200)] focus-visible:outline-offset-4";

function PublicLinks() {
	const { text: translate } = useI18n();
	return (
		<>
			<Link className={publicLinkClass} to="/about">
				{translate(text({ en: "About", hi: "परिचय" }))}
			</Link>
			<Link className={publicLinkClass} to="/" hash="how-it-works">
				{translate(text({ en: "How it works", hi: "यह कैसे काम करता है" }))}
			</Link>
			<Link className={publicLinkClass} to="/privacy">
				{translate(text({ en: "Privacy", hi: "गोपनीयता" }))}
			</Link>
		</>
	);
}

function PublicShell({
	children,
	home = false,
}: Readonly<{ children: ReactNode; home?: boolean }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const headerScrolled = useHeaderScrolled();

	return (
		<div
			className={`min-h-screen bg-[var(--paper)] ${home ? "bg-[radial-gradient(ellipse_90%_52rem_at_0%_0%,rgba(21,89,199,0.2)_0%,rgba(65,128,216,0.09)_38%,transparent_72%)] bg-no-repeat" : ""}`}
		>
			<header
				className="glass-navbar sticky top-0 z-40 bg-transparent"
				data-scrolled={headerScrolled}
			>
				<div className="mx-auto flex min-h-16 w-full max-w-[1280px] items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
					<Link
						className="inline-flex shrink-0 text-inherit no-underline"
						to="/"
						aria-label="UGAAP home"
					>
						<BrandLogo />
					</Link>
					<nav
						className="ml-auto hidden items-center gap-7 lg:flex"
						aria-label={translate(
							text({ en: "Public navigation", hi: "सार्वजनिक नेविगेशन" }),
						)}
					>
						<PublicLinks />
					</nav>
					<div className="ml-auto flex items-center gap-2 lg:ml-6">
						<LanguageControl />
						<Link
							className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--blue-700)] bg-[var(--blue-700)] px-3 text-sm font-semibold text-white no-underline transition-colors hover:border-[var(--blue-900)] hover:bg-[var(--blue-900)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-300)] sm:px-4"
							to={session?.user ? "/services" : "/login"}
							search={session?.user ? { q: "" } : { redirect: "/services" }}
						>
							{session?.user
								? translate(text({ en: "Workspace", hi: "कार्यस्थल" }))
								: translate(text({ en: "Sign in", hi: "साइन इन" }))}
						</Link>
						<details className="group relative lg:hidden">
							<summary className="grid size-10 cursor-pointer list-none place-items-center rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--blue-900)] marker:content-none focus-visible:outline-3 focus-visible:outline-[var(--blue-200)]">
								<Menu size={18} aria-hidden="true" />
								<span className="sr-only">
									{translate(text({ en: "Open menu", hi: "मेनू खोलें" }))}
								</span>
							</summary>
							<nav className="absolute right-0 top-12 grid min-w-52 gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_18px_45px_rgba(16,24,40,0.12)]">
								<PublicLinks />
							</nav>
						</details>
					</div>
				</div>
			</header>

			<main className="min-h-[calc(100vh-240px)]" data-assistant-page-content>
				{children}
			</main>

			<footer className="bg-[var(--paper)] pb-8 pt-16">
				<div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
					<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
						<BrandLogo />
						<p className="m-0 max-w-[420px] text-sm leading-6 text-[var(--ink-muted)]">
							{translate(
								text({
									en: "Describe the issue once. Keep every response and decision in one place.",
									hi: "समस्या एक बार बताएँ। हर जवाब और निर्णय को एक जगह रखें।",
								}),
							)}
						</p>
					</div>
					<nav
						className="flex flex-wrap items-center gap-x-6 gap-y-3"
						aria-label={translate(
							text({ en: "Legal information", hi: "कानूनी जानकारी" }),
						)}
					>
						<Link className={publicLinkClass} to="/terms">
							{translate(text({ en: "Terms", hi: "नियम" }))}
						</Link>
						<Link className={publicLinkClass} to="/privacy">
							{translate(text({ en: "Privacy", hi: "गोपनीयता" }))}
						</Link>
						<Link className={publicLinkClass} to="/cookies">
							{translate(text({ en: "Cookies", hi: "कुकीज़" }))}
						</Link>
					</nav>
				</div>
			</footer>
		</div>
	);
}

function WorkspaceShell({
	children,
	pathname,
}: Readonly<{ children: ReactNode; pathname: string }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();
	const headerScrolled = useHeaderScrolled();
	const title = pathname.startsWith("/drafts")
		? text({ en: "Saved drafts", hi: "सहेजे गए मसौदे" })
		: pathname.startsWith("/continuation")
			? text({ en: "Continue your request", hi: "अपना अनुरोध जारी रखें" })
			: text({ en: "File a grievance", hi: "शिकायत दर्ज करें" });

	async function signOut() {
		await authClient.signOut();
		await navigate({ to: "/" });
	}

	return (
		<SidebarProvider
			defaultOpen
			style={
				{
					"--sidebar-width": "14.5rem",
					"--sidebar-width-icon": "4.25rem",
				} as CSSProperties
			}
		>
			<Sidebar
				collapsible="icon"
				className="border-[var(--sidebar-border)] bg-[var(--sidebar)]"
			>
				<SidebarHeader className="h-16 flex-row items-center px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<Link
						className="flex min-h-10 items-center gap-3 overflow-hidden text-[var(--blue-950)] no-underline group-data-[collapsible=icon]:justify-center"
						to="/"
					>
						<BrandLogo compact />
						<span className="whitespace-nowrap text-sm font-extrabold tracking-[0.12em] group-data-[collapsible=icon]:hidden">
							UGAAP
						</span>
					</Link>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup className="px-2 py-4">
						<SidebarGroupLabel>
							{translate(text({ en: "Your work", hi: "आपका काम" }))}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu className="gap-1.5">
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={pathname.startsWith("/services")}
										tooltip={translate(
											text({ en: "New grievance", hi: "नई शिकायत" }),
										)}
										className="h-11 rounded-lg px-3 data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:text-[var(--blue-900)]"
									>
										<Link to="/services" search={{ q: "" }}>
											<FilePlus2 aria-hidden="true" />
											<span>
												{translate(
													text({ en: "New grievance", hi: "नई शिकायत" }),
												)}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={pathname.startsWith("/drafts")}
										tooltip={translate(text({ en: "Drafts", hi: "मसौदे" }))}
										className="h-11 rounded-lg px-3 data-[active=true]:bg-[var(--sidebar-accent)] data-[active=true]:text-[var(--blue-900)]"
									>
										<Link to="/drafts">
											<FileClock aria-hidden="true" />
											<span>
												{translate(text({ en: "Drafts", hi: "मसौदे" }))}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										tooltip={translate(
											text({ en: "Public home", hi: "मुखपृष्ठ" }),
										)}
										className="h-11 rounded-lg px-3"
									>
										<Link to="/">
											<Home aria-hidden="true" />
											<span>
												{translate(text({ en: "Public home", hi: "मुखपृष्ठ" }))}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter className="p-2.5">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								size="lg"
								className="h-12 rounded-lg px-2.5"
								tooltip={session?.user.name || session?.user.email || "Citizen"}
							>
								<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--blue-100)] text-xs font-extrabold text-[var(--blue-900)]">
									{(session?.user.name || session?.user.email || "C")
										.slice(0, 1)
										.toUpperCase()}
								</span>
								<span className="min-w-0 truncate text-xs font-semibold">
									{session?.user.name ||
										session?.user.email ||
										translate(text({ en: "Citizen", hi: "नागरिक" }))}
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								onClick={() => void signOut()}
								tooltip={translate(text({ en: "Sign out", hi: "साइन आउट" }))}
								className="h-10 rounded-lg px-3"
							>
								<LogOut aria-hidden="true" />
								<span>
									{translate(text({ en: "Sign out", hi: "साइन आउट" }))}
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			<SidebarInset className="min-w-0 bg-[var(--paper)]">
				<header
					className="glass-navbar sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 bg-transparent px-4 sm:px-6 lg:px-8"
					data-scrolled={headerScrolled}
				>
					<div className="flex min-w-0 items-center gap-3">
						<SidebarTrigger className="size-10 rounded-lg text-[var(--blue-900)] hover:bg-[var(--blue-50)]" />
						<span className="truncate text-sm font-semibold text-[var(--ink)]">
							{translate(title)}
						</span>
					</div>
					<LanguageControl />
				</header>
				<div className="w-full pb-40" data-assistant-page-content>
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
