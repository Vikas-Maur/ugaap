import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle2,
	Clock3,
	FilePlus2,
	MessageCircleWarning,
} from "lucide-react";

import {
	type DashboardGrievance,
	getCitizenDashboard,
} from "#/features/dashboard/functions";
import { useI18n } from "#/features/i18n/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
	loader: () => getCitizenDashboard(),
	component: DashboardScreen,
});

function DashboardScreen() {
	const { text } = useI18n();
	const summary = Route.useLoaderData();
	const firstName = summary.citizenName.trim().split(/\s+/)[0] || "Citizen";

	return (
		<main className="page-shell !max-w-[1120px]">
			<section className="border-b-2 border-[var(--line-strong)] pb-9 pt-2">
				<p className="page-eyebrow">
					{text({ en: "Your citizen workspace", hi: "आपका नागरिक कार्यस्थल" })}
				</p>
				<h1 className="page-title max-w-[760px]">
					{text({
						en: `Namaste, ${firstName}. What would you like to do?`,
						hi: `नमस्ते, ${firstName}। आप क्या करना चाहेंगे?`,
					})}
				</h1>
				<p className="page-intro max-w-[660px]">
					{text({
						en: "Start a new grievance, continue a saved draft, or check whether an authority needs your reply.",
						hi: "नई शिकायत शुरू करें, सहेजा हुआ मसौदा पूरा करें, या देखें कि किसी विभाग को आपके जवाब की ज़रूरत है।",
					})}
				</p>
				<Link
					to="/services"
					search={{ q: "" }}
					className="action-primary mt-7 inline-flex items-center gap-3 no-underline"
				>
					<FilePlus2 size={20} aria-hidden="true" />
					{text({ en: "Start a grievance", hi: "शिकायत शुरू करें" })}
					<ArrowRight size={18} aria-hidden="true" />
				</Link>
			</section>

			{summary.needsReply.length > 0 ? (
				<section
					className="mt-8 border-2 border-[var(--action)] bg-[var(--paper)] px-5 py-6 sm:px-7 sm:py-7"
					aria-labelledby="needs-reply-heading"
				>
					<div className="flex items-start gap-3">
						<MessageCircleWarning
							className="mt-1 shrink-0 text-[var(--action)]"
							size={25}
							aria-hidden="true"
						/>
						<div>
							<p className="page-eyebrow">
								{text({ en: "Your attention", hi: "आपका ध्यान चाहिए" })}
							</p>
							<h2
								id="needs-reply-heading"
								className="mt-1 text-2xl font-extrabold text-[var(--ink)]"
							>
								{text({
									en: "An authority is waiting for your reply",
									hi: "एक विभाग आपके जवाब की प्रतीक्षा कर रहा है",
								})}
							</h2>
						</div>
					</div>
					<GrievanceRows
						items={summary.needsReply}
						actionLabel={text({ en: "Reply now", hi: "अभी जवाब दें" })}
					/>
				</section>
			) : null}

			<section className="grid gap-10 border-b border-[var(--line-strong)] py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
				<div>
					<SectionHeading
						icon={Clock3}
						title={text({ en: "Saved drafts", hi: "सहेजे हुए मसौदे" })}
						description={text({
							en: "Continue from where you stopped.",
							hi: "जहाँ रुके थे, वहीं से आगे बढ़ें।",
						})}
					/>
					{summary.drafts.length ? (
						<ul className="mt-5 border-t border-[var(--line-strong)]">
							{summary.drafts.map((draft) => (
								<li key={draft.id} className="border-b border-[var(--line)]">
									<Link
										to="/services/$authoritySlug"
										params={{ authoritySlug: draft.authoritySlug }}
										search={{
											form: draft.formKey,
											review: false,
											draft: draft.id,
										}}
										className="group flex min-h-20 items-center justify-between gap-4 py-4 text-inherit no-underline hover:bg-[var(--blue-50)] sm:px-2"
									>
										<span className="min-w-0">
											<span className="block truncate font-extrabold text-[var(--ink)]">
												{draft.formTitle}
											</span>
											<span className="mt-1 block text-sm text-[var(--ink-muted)]">
												{draft.authorityName} · {relativeDate(draft.updatedAt)}
											</span>
										</span>
										<span className="inline-flex shrink-0 items-center gap-1 text-sm font-extrabold text-[var(--action)]">
											{text({ en: "Continue", hi: "जारी रखें" })}
											<ArrowRight size={17} />
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<EmptyLine>
							{text({
								en: "No saved drafts. A form you save will appear here.",
								hi: "कोई सहेजा हुआ मसौदा नहीं है। सहेजा गया फ़ॉर्म यहाँ दिखेगा।",
							})}
						</EmptyLine>
					)}
				</div>
				<div>
					<SectionHeading
						icon={Clock3}
						title={text({ en: "Cases in progress", hi: "चल रही शिकायतें" })}
						description={text({
							en: "The latest movement on your submitted grievances.",
							hi: "आपकी जमा की गई शिकायतों की नवीनतम स्थिति।",
						})}
					/>
					{summary.active.length ? (
						<GrievanceRows items={summary.active} />
					) : (
						<EmptyLine>
							{text({
								en: "No active grievances right now.",
								hi: "अभी कोई सक्रिय शिकायत नहीं है।",
							})}
						</EmptyLine>
					)}
				</div>
			</section>

			<section className="py-10" aria-labelledby="resolved-heading">
				<SectionHeading
					icon={CheckCircle2}
					title={text({ en: "Recently resolved", hi: "हाल में निस्तारित" })}
					description={text({
						en: "Completed cases remain available with their full history.",
						hi: "पूरी हो चुकी शिकायतें अपने पूरे इतिहास के साथ उपलब्ध रहती हैं।",
					})}
					id="resolved-heading"
				/>
				{summary.recentlyResolved.length ? (
					<GrievanceRows items={summary.recentlyResolved} />
				) : (
					<EmptyLine>
						{text({
							en: "Resolved grievances will appear here.",
							hi: "निस्तारित शिकायतें यहाँ दिखाई देंगी।",
						})}
					</EmptyLine>
				)}
				<Link
					to="/grievances"
					className="mt-6 inline-flex min-h-11 items-center gap-2 font-extrabold text-[var(--action)] hover:text-[var(--action-hover)]"
				>
					{text({ en: "View all grievances", hi: "सभी शिकायतें देखें" })}
					<ArrowRight size={17} />
				</Link>
			</section>
		</main>
	);
}

function SectionHeading({
	icon: Icon,
	title,
	description,
	id,
}: {
	icon: typeof Clock3;
	title: string;
	description: string;
	id?: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<Icon
				className="mt-1 shrink-0 text-[var(--action)]"
				size={22}
				aria-hidden="true"
			/>
			<div>
				<h2 id={id} className="text-xl font-extrabold text-[var(--ink)]">
					{title}
				</h2>
				<p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
					{description}
				</p>
			</div>
		</div>
	);
}

function GrievanceRows({
	items,
	actionLabel,
}: {
	items: DashboardGrievance[];
	actionLabel?: string;
}) {
	return (
		<ul className="mt-5 border-t border-[var(--line-strong)]">
			{items.map((item) => (
				<li key={item.registrationId} className="border-b border-[var(--line)]">
					<Link
						to="/grievances/$registrationId"
						params={{ registrationId: item.registrationId }}
						className="group grid gap-2 py-4 text-inherit no-underline hover:bg-[var(--blue-50)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-2"
					>
						<span className="min-w-0">
							<span className="block truncate font-extrabold text-[var(--ink)]">
								{item.formTitle}
							</span>
							<span className="mt-1 block text-sm text-[var(--ink-muted)]">
								{item.organizationName} · {item.registrationId}
							</span>
						</span>
						<span className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--action-hover)]">
							<span className="status-pill border-[var(--action)] bg-[var(--highlight-soft)] text-[var(--action-hover)]">
								{statusLabel(item.status)}
							</span>
							{actionLabel ?? relativeDate(item.updatedAt)}
							<ArrowRight size={16} />
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}

function EmptyLine({ children }: { children: string }) {
	return (
		<p className="mt-5 border-y border-[var(--line)] py-5 text-sm leading-6 text-[var(--ink-muted)]">
			{children}
		</p>
	);
}

function statusLabel(status: string) {
	return status
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeDate(value: string) {
	const days = Math.max(
		0,
		Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
	);
	if (days === 0) return "Updated today";
	if (days === 1) return "Updated yesterday";
	return `Updated ${days} days ago`;
}
