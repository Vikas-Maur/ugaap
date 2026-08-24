import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { useI18n } from "#/features/i18n/i18n";
import { getPublicGrievance } from "#/features/public-grievances/functions";
import { PublicStatus } from "./index";

export const Route = createFileRoute("/public-grievances/$publicId")({
	loader: ({ params }) =>
		getPublicGrievance({ data: { publicId: params.publicId } }),
	component: PublicGrievanceDetail,
});

function PublicGrievanceDetail() {
	const grievance = Route.useLoaderData();
	const { text } = useI18n();
	return (
		<main className="page-shell">
			<Link
				className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--blue-800)] no-underline hover:text-[var(--blue-950)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--blue-700)]"
				to="/public-grievances"
				search={{
					q: "",
					status: "all",
					organization: "all",
					sort: "recent",
				}}
			>
				<ArrowLeft size={17} aria-hidden="true" />
				{text({ en: "Public grievances", hi: "सार्वजनिक शिकायतें" })}
			</Link>

			<header className="mt-9 border-b-2 border-[var(--blue-700)] pb-7">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="page-eyebrow">
							{text({
								en: "Redacted public record",
								hi: "संपादित सार्वजनिक रिकॉर्ड",
							})}
						</p>
						<h1 className="page-title mt-2">{grievance.organization.name}</h1>
						<p className="mt-3 font-mono text-sm font-bold tracking-wide text-[var(--blue-950)]">
							{grievance.publicId}
						</p>
					</div>
					<PublicStatus status={grievance.status} />
				</div>
				{grievance.synthetic ? (
					<p className="mt-5 border-l-4 border-violet-600 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-950">
						{text({
							en: "This is synthetic methodology-demo data, not a real citizen grievance.",
							hi: "यह कृत्रिम कार्यप्रणाली-डेमो डेटा है, वास्तविक नागरिक शिकायत नहीं।",
						})}
					</p>
				) : null}
			</header>

			<section className="border-b border-[var(--line)] py-8">
				<h2 className="text-xl font-bold text-[var(--blue-950)]">
					{text({ en: "Public summary", hi: "सार्वजनिक सारांश" })}
				</h2>
				<p className="mt-4 max-w-4xl whitespace-pre-wrap text-lg leading-8 text-[var(--ink)]">
					{grievance.summary}
				</p>
				<dl className="mt-6 border-t border-[var(--line)]">
					<Detail
						label={text({ en: "Organization", hi: "संगठन" })}
						value={grievance.organization.name}
					/>
					<Detail
						label={text({ en: "Category", hi: "श्रेणी" })}
						value={grievance.categoryPath.join(" › ")}
					/>
					<Detail
						label={text({ en: "Broad location", hi: "व्यापक स्थान" })}
						value={
							grievance.broadLocation ||
							text({ en: "Not included", hi: "शामिल नहीं" })
						}
					/>
					<Detail
						label={text({ en: "Published", hi: "प्रकाशित" })}
						value={formatDateTime(grievance.publishedAt)}
					/>
				</dl>
			</section>

			<section className="py-8" aria-labelledby="public-timeline-title">
				<h2
					id="public-timeline-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Public status timeline", hi: "सार्वजनिक स्थिति समयरेखा" })}
				</h2>
				<p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
					{text({
						en: "Only status changes are shown. Questions, replies, evidence, and internal remarks remain private.",
						hi: "केवल स्थिति बदलाव दिखाए जाते हैं। प्रश्न, उत्तर, साक्ष्य और आंतरिक टिप्पणियां निजी रहती हैं।",
					})}
				</p>
				<ol className="relative mt-6 border-l-2 border-[var(--blue-200)] pl-6">
					{grievance.events.map((event) => (
						<li key={event.id} className="relative pb-8 last:pb-0">
							<span className="absolute -left-[2.05rem] top-1 grid size-4 place-items-center rounded-full border-2 border-[var(--blue-700)] bg-[var(--paper)]">
								{event.status === "resolved" ||
								event.status === "appeal_resolved" ? (
									<CircleCheck size={9} aria-hidden="true" />
								) : null}
							</span>
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-bold text-[var(--blue-950)]">
									{event.label}
								</p>
								<PublicStatus status={event.status} />
							</div>
							<p className="mt-1 text-xs font-medium text-[var(--ink-muted)]">
								{formatDateTime(event.occurredAt)}
							</p>
						</li>
					))}
				</ol>
			</section>
		</main>
	);
}

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div className="grid gap-1 border-b border-[var(--line)] py-4 sm:grid-cols-[minmax(10rem,0.4fr)_1fr] sm:gap-5">
			<dt className="text-sm font-bold text-[var(--ink-muted)]">{label}</dt>
			<dd className="break-words text-[var(--ink)]">{value}</dd>
		</div>
	);
}

function formatDateTime(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
}
