import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList } from "lucide-react";

import { listGrievances } from "#/features/grievances/functions";
import { useI18n } from "#/features/i18n/i18n";

export const Route = createFileRoute("/_authenticated/grievances/")({
	loader: () => listGrievances(),
	component: GrievanceListScreen,
});

function GrievanceListScreen() {
	const { text } = useI18n();
	const grievances = Route.useLoaderData();

	return (
		<main className="page-shell">
			<p className="page-eyebrow">
				{text({ en: "Your work", hi: "आपका काम" })}
			</p>
			<h1 className="page-title">
				{text({ en: "My grievances", hi: "मेरी शिकायतें" })}
			</h1>
			<p className="page-intro">
				{text({
					en: "Track each submission and respond when an authority needs more information.",
					hi: "हर शिकायत की स्थिति देखें और प्राधिकरण को जानकारी चाहिए तो उत्तर दें।",
				})}
			</p>

			{grievances.length === 0 ? (
				<section
					className="mt-10 border-y border-[var(--line)] py-10"
					aria-labelledby="no-grievances-title"
				>
					<ClipboardList
						className="text-[var(--blue-700)]"
						size={28}
						aria-hidden="true"
					/>
					<h2
						id="no-grievances-title"
						className="mt-4 text-xl font-bold text-[var(--blue-950)]"
					>
						{text({
							en: "No grievances submitted",
							hi: "कोई शिकायत दर्ज नहीं है",
						})}
					</h2>
					<p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
						{text({
							en: "Choose a service to describe an issue and submit it after reviewing every detail.",
							hi: "समस्या बताने के लिए कोई सेवा चुनें। हर विवरण देखने के बाद ही शिकायत जमा होगी।",
						})}
					</p>
					<Link
						className="action-primary mt-6 inline-flex items-center gap-2 no-underline"
						to="/services"
						search={{ q: "" }}
					>
						{text({ en: "Find a service", hi: "सेवा खोजें" })}
						<ArrowRight size={17} aria-hidden="true" />
					</Link>
				</section>
			) : (
				<ul className="mt-9 border-t border-[var(--line)]">
					{grievances.map((grievance) => (
						<li
							key={grievance.registrationId}
							className="border-b border-[var(--line)]"
						>
							<Link
								className="group grid gap-3 py-5 text-inherit no-underline transition-colors hover:bg-[var(--blue-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-700)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-3"
								to="/grievances/$registrationId"
								params={{ registrationId: grievance.registrationId }}
							>
								<div className="min-w-0">
									<p className="text-base font-bold text-[var(--blue-950)] sm:text-lg">
										{grievance.formTitle}
									</p>
									<p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
										{grievance.organizationName}{" "}
										<span aria-hidden="true">·</span> {grievance.registrationId}
									</p>
									<p className="mt-1 text-xs font-medium text-[var(--ink-muted)]">
										{text({ en: "Submitted", hi: "जमा किया" })}{" "}
										{formatDate(grievance.submittedAt)}
									</p>
								</div>
								<div className="flex items-center gap-3 sm:justify-end">
									<StatusLabel status={grievance.status} />
									<ArrowRight
										className="text-[var(--blue-800)] transition-transform group-hover:translate-x-0.5"
										size={18}
										aria-hidden="true"
									/>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

export function StatusLabel({ status }: { status: string }) {
	const { text } = useI18n();
	return (
		<span
			className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold ${statusBadgeClass(status)}`}
		>
			{text({ en: statusLabel(status), hi: statusLabelHindi(status) })}
		</span>
	);
}

function statusBadgeClass(status: string) {
	const classes: Record<string, string> = {
		submitted: "border-blue-300 bg-blue-50 text-blue-900",
		acknowledged: "border-sky-300 bg-sky-50 text-sky-950",
		routed: "border-indigo-300 bg-indigo-50 text-indigo-950",
		in_review: "border-[var(--blue-300)] bg-[var(--blue-50)] text-[var(--blue-900)]",
		needs_information: "border-amber-300 bg-amber-50 text-amber-950",
		action_taken: "border-indigo-300 bg-indigo-50 text-indigo-950",
		resolved: "border-emerald-300 bg-emerald-50 text-emerald-950",
		appealed: "border-violet-300 bg-violet-50 text-violet-950",
		appeal_resolved: "border-emerald-300 bg-emerald-50 text-emerald-950",
		withdrawn: "border-slate-300 bg-slate-100 text-slate-700",
	};
	return classes[status] ?? "border-slate-300 bg-slate-100 text-slate-700";
}

function statusLabel(status: string) {
	return status
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabelHindi(status: string) {
	const labels: Record<string, string> = {
		submitted: "जमा किया गया",
		acknowledged: "प्राप्ति दर्ज",
		routed: "भेजा गया",
		in_review: "समीक्षा में",
		needs_information: "जानकारी चाहिए",
		action_taken: "कार्रवाई की गई",
		resolved: "निस्तारित",
		appealed: "अपील की गई",
		appeal_resolved: "अपील निस्तारित",
		withdrawn: "वापस लिया गया",
	};
	return labels[status] ?? statusLabel(status);
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
