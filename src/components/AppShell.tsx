import { Link, useRouterState } from "@tanstack/react-router";
import {
	ClipboardList,
	FileClock,
	FilePlus2,
	Gauge,
	Globe2,
	Home,
	LogIn,
	Menu,
} from "lucide-react";
import type { ReactNode } from "react";

import { text, useI18n } from "../features/i18n/i18n";
import { authClient } from "../lib/auth-client";
import { AssistantEntry } from "./AssistantEntry";
import { BrandLogo } from "./BrandLogo";
import { SignOutButton } from "./SignOutButton";
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
	SidebarTrigger,
} from "./ui/sidebar";

const workspacePrefixes = [
	"/dashboard",
	"/services",
	"/drafts",
	"/continuation",
	"/grievances",
];

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
					<PublicShell>{children}</PublicShell>
				)}
			</div>
			<AssistantEntry home={pathname === "/"} workspace={isWorkspace} />
		</>
	);
}
function LanguageControl({ inverse = false }: { inverse?: boolean }) {
	const { language, toggleLanguage } = useI18n();
	const switchLabel = language === "en" ? "हिंदी" : "English";
	const switchAriaLabel =
		language === "en" ? "Switch to Hindi" : "Switch to English";
	return (
		<button
			className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] ${
				inverse
					? "border-white/45 text-white hover:bg-white/10"
					: "border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--action)] hover:bg-[var(--blue-50)]"
			}`}
			type="button"
			onClick={toggleLanguage}
			aria-label={switchAriaLabel}
		>
			<Globe2 size={17} aria-hidden="true" />
			<span className="text-xs sm:hidden">
				{language === "en" ? "हिं" : "EN"}
			</span>
			<span className="hidden sm:inline">{switchLabel}</span>
		</button>
	);
}

const publicLinkClass =
	"text-sm font-bold text-[var(--ink-muted)] no-underline transition-colors hover:text-[var(--action)] focus-visible:rounded-sm focus-visible:outline-3 focus-visible:outline-[var(--highlight)] focus-visible:outline-offset-4";

function PublicLinks() {
	const { text: translate } = useI18n();
	return (
		<>
			<Link
				className={publicLinkClass}
				to="/public-grievances"
				search={{ q: "", status: "all", organization: "all", sort: "recent" }}
			>
				{translate(
					text({
						en: "Public grievances",
						hi: "सार्वजनिक शिकायतें",
					}),
				)}
			</Link>
			<Link
				className={publicLinkClass}
				to="/leaderboard"
				search={{ group: "central", compare: "" }}
			>
				{translate(text({ en: "Performance", hi: "प्रदर्शन" }))}
			</Link>
			<Link className={publicLinkClass} to="/about">
				{translate(text({ en: "About", hi: "परिचय" }))}
			</Link>
			<Link className={publicLinkClass} to="/methodology">
				{translate(
					text({
						en: "How scores work",
						hi: "स्कोर कैसे बनते हैं",
					}),
				)}
			</Link>
		</>
	);
}

function PublicShell({ children }: Readonly<{ children: ReactNode }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();

	return (
		<div className="min-h-screen bg-[var(--cream)]">
			<header className="glass-navbar sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--cream)_92%,transparent)] backdrop-blur-xl">
				<div className="mx-auto flex min-h-[72px] w-full max-w-[1440px] items-center gap-2 px-3 sm:gap-3 sm:px-7 lg:px-10">
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
							text({
								en: "Public pages",
								hi: "सार्वजनिक पृष्ठ",
							}),
						)}
					>
						<PublicLinks />
					</nav>
					<div className="ml-auto flex items-center gap-2 lg:ml-6">
						<LanguageControl />
						<Link
							className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--action)] bg-[var(--action)] px-0 text-sm font-bold text-white no-underline transition-colors hover:bg-[var(--action-hover)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] sm:px-4"
							to={session?.user ? "/dashboard" : "/login"}
							search={session?.user ? undefined : { redirect: "/dashboard" }}
							aria-label={translate(
								session?.user
									? text({
											en: "Open my workspace",
											hi: "मेरा कार्यस्थल खोलें",
										})
									: text({ en: "Sign in", hi: "साइन इन" }),
							)}
						>
							{session?.user ? (
								<Gauge className="sm:hidden" size={18} aria-hidden="true" />
							) : (
								<LogIn className="sm:hidden" size={18} aria-hidden="true" />
							)}
							<span className="hidden sm:inline">
								{session?.user
									? translate(
											text({
												en: "My workspace",
												hi: "मेरा कार्यस्थल",
											}),
										)
									: translate(text({ en: "Sign in", hi: "साइन इन" }))}
							</span>
						</Link>
						<details className="group relative lg:hidden">
							<summary className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] marker:content-none focus-visible:outline-3 focus-visible:outline-[var(--highlight)]">
								<Menu size={19} aria-hidden="true" />
								<span className="sr-only">
									{translate(
										text({
											en: "Open menu",
											hi: "मेनू खोलें",
										}),
									)}
								</span>
							</summary>
							<nav className="absolute right-0 top-14 grid min-w-60 gap-5 rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-xl">
								<PublicLinks />
							</nav>
						</details>
					</div>
				</div>
			</header>

			<main
				className="min-h-[calc(100vh-300px)] pb-32"
				data-assistant-page-content
			>
				{children}
			</main>

			<footer className="border-t-2 border-[var(--ink)] bg-[var(--paper)] pb-32 pt-12">
				<div className="mx-auto grid w-full max-w-[1440px] gap-8 px-5 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10">
					<div>
						<BrandLogo />
						<p className="mt-4 max-w-[520px] text-sm leading-6 text-[var(--ink-muted)]">
							{translate(
								text({
									en: "Describe the problem once. Keep every reply and decision in one place.",
									hi: "समस्या एक बार बताएं। हर जवाब और निर्णय एक ही जगह रखें।",
								}),
							)}
						</p>
					</div>
					<nav
						className="flex flex-wrap gap-x-6 gap-y-3"
						aria-label={translate(
							text({
								en: "Legal information",
								hi: "कानूनी जानकारी",
							}),
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

const navItems = [
	{
		to: "/dashboard",
		label: text({ en: "Dashboard", hi: "मुख्य पृष्ठ" }),
		icon: Gauge,
	},
	{
		to: "/services",
		label: text({
			en: "Start a grievance",
			hi: "शिकायत शुरू करें",
		}),
		icon: FilePlus2,
		search: { q: "" },
	},
	{
		to: "/drafts",
		label: text({ en: "Drafts", hi: "मसौदे" }),
		icon: FileClock,
	},
	{
		to: "/grievances",
		label: text({
			en: "My grievances",
			hi: "मेरी शिकायतें",
		}),
		icon: ClipboardList,
	},
] as const;

function WorkspaceShell({
	children,
	pathname,
}: Readonly<{ children: ReactNode; pathname: string }>) {
	const { text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const title = pathname.startsWith("/dashboard")
		? text({
				en: "Your dashboard",
				hi: "आपका मुख्य पृष्ठ",
			})
		: pathname.startsWith("/drafts")
			? text({
					en: "Saved drafts",
					hi: "सहेजे गए मसौदे",
				})
			: pathname.startsWith("/grievances")
				? text({
						en: "My grievances",
						hi: "मेरी शिकायतें",
					})
				: text({
						en: "Start a grievance",
						hi: "शिकायत शुरू करें",
					});

	return (
		<SidebarProvider defaultOpen className="min-h-screen bg-[var(--cream)]">
			<Sidebar
				collapsible="icon"
				className="border-[var(--sidebar-border)] bg-[var(--sidebar)]"
			>
				<SidebarHeader className="border-b border-[var(--sidebar-border)] p-4 group-data-[collapsible=icon]:p-2">
					<Link
						to="/"
						className="flex items-center justify-center text-[var(--ink)] no-underline"
						aria-label="UGAAP home"
					>
						<span className="group-data-[collapsible=icon]:hidden">
							<BrandLogo />
						</span>
						<span className="hidden group-data-[collapsible=icon]:inline-flex">
							<BrandLogo variant="mark" />
						</span>
					</Link>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup className="p-3">
						<SidebarGroupLabel className="px-2 text-[var(--ink-muted)]">
							{translate(text({ en: "Your work", hi: "आपका काम" }))}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{navItems.map((item) => {
									const Icon = item.icon;
									const isActive =
										pathname === item.to ||
										(item.to !== "/dashboard" &&
											pathname.startsWith(`${item.to}/`));

									return (
										<SidebarMenuItem key={item.to}>
											<SidebarMenuButton
												asChild
												isActive={isActive}
												tooltip={translate(item.label)}
												className="text-[var(--ink-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--ink)] data-[active=true]:bg-[var(--highlight)] data-[active=true]:text-[var(--ink)]"
											>
												<Link
													to={item.to}
													search={"search" in item ? item.search : undefined}
												>
													<Icon size={19} aria-hidden="true" />
													<span>{translate(item.label)}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter className="border-t border-[var(--sidebar-border)] p-3">
					<p className="truncate px-2 text-sm font-bold text-[var(--ink)] group-data-[collapsible=icon]:hidden">
						{session?.user.name ||
							session?.user.email ||
							translate(text({ en: "Citizen", hi: "नागरिक" }))}
					</p>
					<SignOutButton />
				</SidebarFooter>
			</Sidebar>

			<SidebarInset className="min-w-0 bg-[var(--cream)]">
				<header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--cream)_94%,transparent)] backdrop-blur-xl">
					<div className="mx-auto flex min-h-[72px] w-full max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
						<div className="flex min-w-0 items-center gap-3">
							<SidebarTrigger className="size-10 shrink-0 rounded-lg border border-[var(--line-strong)] text-[var(--ink)] hover:bg-[var(--blue-50)]" />
							<span className="truncate text-base font-extrabold text-[var(--ink)]">
								{translate(title)}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Link
								to="/"
								className="hidden min-h-11 items-center gap-2 text-sm font-bold text-[var(--ink-muted)] no-underline hover:text-[var(--action)] sm:inline-flex"
							>
								<Home size={17} aria-hidden="true" />
								{translate(
									text({
										en: "Public home",
										hi: "सार्वजनिक पृष्ठ",
									}),
								)}
							</Link>
							<LanguageControl />
						</div>
					</div>
				</header>

				<div className="w-full pb-44 md:pb-32" data-assistant-page-content>
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
