import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowUpRight,
	BadgeCheck,
	Building2,
	MapPin,
	MessageCircle,
	Search,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { useI18n } from "#/features/i18n/i18n";
import { listPublicGrievances } from "#/features/public-grievances/functions";

const feedStatusSchema = z.enum([
	"all",
	"submitted",
	"acknowledged",
	"routed",
	"in_review",
	"needs_information",
	"action_taken",
	"resolved",
	"appealed",
	"appeal_resolved",
	"withdrawn",
]);
const feedSearchSchema = z.object({
	q: z.string().trim().max(80).catch(""),
	status: feedStatusSchema.catch("all"),
	organization: z.string().trim().max(120).catch("all"),
	sort: z.enum(["recent", "updated"]).catch("recent"),
});

export const Route = createFileRoute("/public-grievances/")({
	validateSearch: feedSearchSchema,
	loaderDeps: ({ search: { q, status, organization, sort } }) => ({
		q,
		status,
		organization,
		sort,
	}),
	loader: ({ deps }) => listPublicGrievances({ data: deps }),
	component: PublicGrievanceFeed,
});

function PublicGrievanceFeed() {
	const { items, metrics, organizationOptions } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { text } = useI18n();
	const [query, setQuery] = useState(search.q);
	const [status, setStatus] = useState(search.status);
	const [organization, setOrganization] = useState(search.organization);
	const [sort, setSort] = useState(search.sort);

	useEffect(() => {
		setQuery(search.q);
		setStatus(search.status);
		setOrganization(search.organization);
		setSort(search.sort);
	}, [search]);

	function applyFilters(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void navigate({
			search: feedSearchSchema.parse({
				q: query,
				status,
				organization,
				sort,
			}),
		});
	}

	return (
		<main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
			<header className="border-b-2 border-[var(--blue-700)] pb-8">
				<p className="page-eyebrow">
					{text({ en: "Public accountability", hi: "सार्वजनिक जवाबदेही" })}
				</p>
				<h1 className="page-title mt-2">
					{text({ en: "The public grievance feed", hi: "सार्वजनिक शिकायत फ़ीड" })}
				</h1>
				<p className="page-intro max-w-3xl">
					{text({
						en: "Each post is a citizen-approved redacted copy. Open a thread to see privacy-safe status updates from the official grievance.",
						hi: "हर पोस्ट नागरिक द्वारा स्वीकृत संपादित प्रति है। आधिकारिक शिकायत के गोपनीयता-सुरक्षित स्थिति बदलाव देखने के लिए थ्रेड खोलें।",
					})}
				</p>
			</header>

			<section
				className="border-b border-[var(--line)]"
				aria-labelledby="metric-window-title"
			>
				<div className="flex flex-wrap items-baseline justify-between gap-3 py-5">
					<div>
						<h2
							id="metric-window-title"
							className="text-sm font-bold text-[var(--blue-950)]"
						>
							{text({
								en: "All official grievances",
								hi: "सभी आधिकारिक शिकायतें",
							})}
						</h2>
						<p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--ink-muted)]">
							{text({
								en: "Rolling 90-day totals include private and publicly shared cases. A public copy is never counted as another grievance.",
								hi: "पिछले 90 दिनों के आंकड़ों में निजी और सार्वजनिक रूप से साझा मामले शामिल हैं। सार्वजनिक प्रति को दूसरी शिकायत के रूप में नहीं गिना जाता।",
							})}
						</p>
					</div>
					<p className="text-xs font-semibold text-[var(--ink-muted)]">
						{formatWindow(metrics.windowStart, metrics.windowEnd)}
					</p>
				</div>
				{metrics.syntheticCaseCount > 0 ? (
					<p className="border-t border-violet-200 bg-violet-50 px-4 py-3 text-xs font-semibold leading-5 text-violet-950">
						{text({
							en: `Methodology demo. ${metrics.syntheticCaseCount} of ${metrics.total} official cases in this window are synthetic, so these values are not live government performance figures.`,
							hi: `कार्यप्रणाली डेमो। इस अवधि के ${metrics.total} आधिकारिक मामलों में से ${metrics.syntheticCaseCount} कृत्रिम हैं, इसलिए ये वास्तविक सरकारी प्रदर्शन आंकड़े नहीं हैं।`,
						})}
					</p>
				) : null}
				<dl className="grid border-t border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
					<Metric
						label={text({ en: "Official cases", hi: "आधिकारिक मामले" })}
						value={String(metrics.total)}
						note={`${metrics.active} ${text({ en: "currently active", hi: "अभी सक्रिय" })}`}
					/>
					<Metric
						label={text({ en: "Resolution rate", hi: "समाधान दर" })}
						value={`${metrics.resolutionRate}%`}
						note={`${metrics.resolved} ${text({ en: "resolved cases", hi: "सुलझे मामले" })}`}
					/>
					<Metric
						label={text({ en: "Citizen satisfaction", hi: "नागरिक संतुष्टि" })}
						value={
							metrics.averageSatisfaction === null
								? text({ en: "No ratings", hi: "कोई रेटिंग नहीं" })
								: `${metrics.averageSatisfaction.toFixed(1)} / 5`
						}
						note={`${metrics.ratingCount} ${text({ en: "ratings", hi: "रेटिंग" })}`}
					/>
					<Metric
						label={text({ en: "Publicly shared", hi: "सार्वजनिक रूप से साझा" })}
						value={String(metrics.publicCopyCount)}
						note={`${metrics.appealCount} ${text({ en: "appeals across all cases", hi: "सभी मामलों में अपील" })}`}
					/>
				</dl>
			</section>

			<form
				className="grid gap-3 border-b border-[var(--line)] py-6 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.45fr)_minmax(12rem,0.55fr)_minmax(9rem,0.35fr)_auto] md:items-end"
				onSubmit={applyFilters}
			>
				<label className="text-xs font-bold text-[var(--blue-950)]">
					{text({ en: "Search posts", hi: "पोस्ट खोजें" })}
					<span className="mt-2 flex min-h-11 items-center border border-[var(--line-strong)] bg-[var(--paper)] px-3 focus-within:border-[var(--blue-700)]">
						<Search size={16} aria-hidden="true" />
						<input
							className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm outline-none"
							value={query}
							maxLength={80}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</span>
				</label>
				<FeedSelect
					label={text({ en: "Status", hi: "स्थिति" })}
					value={status}
					onChange={(value) => setStatus(feedStatusSchema.parse(value))}
					options={[
						{
							value: "all",
							label: text({ en: "All statuses", hi: "सभी स्थितियां" }),
						},
						...feedStatusSchema.options
							.filter((value) => value !== "all")
							.map((value) => ({ value, label: titleCase(value) })),
					]}
				/>
				<FeedSelect
					label={text({ en: "Organization", hi: "संगठन" })}
					value={organization}
					onChange={setOrganization}
					options={[
						{
							value: "all",
							label: text({ en: "All organizations", hi: "सभी संगठन" }),
						},
						...organizationOptions.map((option) => ({
							value: option.slug,
							label: option.name,
						})),
					]}
				/>
				<FeedSelect
					label={text({ en: "Order", hi: "क्रम" })}
					value={sort}
					onChange={(value) =>
						setSort(z.enum(["recent", "updated"]).parse(value))
					}
					options={[
						{
							value: "recent",
							label: text({ en: "Recently published", hi: "हाल में प्रकाशित" }),
						},
						{
							value: "updated",
							label: text({ en: "Recently updated", hi: "हाल में अपडेट" }),
						},
					]}
				/>
				<button className="action-primary" type="submit">
					{text({ en: "Apply", hi: "लागू करें" })}
				</button>
				<div className="md:col-span-full">
					<Link
						className="text-xs font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
						to="/public-grievances"
						search={{
							q: "",
							status: "all",
							organization: "all",
							sort: "recent",
						}}
					>
						{text({ en: "Clear filters", hi: "फ़िल्टर हटाएं" })}
					</Link>
				</div>
			</form>

			<div className="flex flex-wrap items-baseline justify-between gap-3 py-6">
				<h2 className="text-xl font-bold text-[var(--blue-950)]">
					{text({ en: "Public posts", hi: "सार्वजनिक पोस्ट" })}
				</h2>
				<p className="text-sm font-semibold text-[var(--ink-muted)]">
					{items.length} {text({ en: "shown", hi: "दिखाए गए" })}
				</p>
			</div>

			{items.length ? (
				<section
					className="border-t-2 border-[var(--ink)]"
					aria-label={text({
						en: "Public grievance posts",
						hi: "सार्वजनिक शिकायत पोस्ट",
					})}
				>
					{items.map((grievance) => (
						<article
							key={grievance.publicId}
							className="grid gap-5 border-b border-[var(--line-strong)] py-7 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-start md:gap-8"
						>
							<header className="flex items-start gap-3">
								<span className="grid size-11 shrink-0 place-items-center border border-[var(--line-strong)] bg-[var(--highlight)] text-[var(--ink)]">
									<Building2 size={20} aria-hidden="true" />
								</span>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
										<h3 className="truncate font-bold text-[var(--blue-950)]">
											{grievance.organizationName}
										</h3>
										<BadgeCheck
											className="shrink-0 fill-[var(--blue-700)] text-white"
											size={17}
											aria-label={text({
												en: "Official organization",
												hi: "आधिकारिक संगठन",
											})}
										/>
										{grievance.synthetic ? (
											<span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-violet-900">
												{text({ en: "Demo", hi: "डेमो" })}
											</span>
										) : null}
									</div>
									<p className="mt-0.5 text-xs text-[var(--ink-muted)]">
										@{grievance.organizationSlug} ·{" "}
										{formatDate(grievance.publishedAt)}
									</p>
								</div>
							</header>

							<div>
								<p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-[var(--ink)]">
									{grievance.summary}
								</p>
								<div className="mt-4 flex flex-wrap gap-2">
									<PublicStatus status={grievance.status} />
									<span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)]">
										#
										{grievance.categoryPath.at(-1)?.replaceAll(/\s+/g, "") ||
											"grievance"}
									</span>
								</div>
								{grievance.broadLocation ? (
									<p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
										<MapPin size={14} aria-hidden="true" />
										{grievance.broadLocation}
									</p>
								) : null}
							</div>
							<footer className="flex items-center justify-between gap-3 md:flex-col md:items-end">
								<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-muted)]">
									<MessageCircle size={15} aria-hidden="true" />
									{grievance.updateCount} {text({ en: "updates", hi: "अपडेट" })}
								</span>
								<Link
									className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[var(--action)] no-underline hover:text-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--action)]"
									to="/public-grievances/$publicId"
									params={{ publicId: grievance.publicId }}
								>
									{text({ en: "Open thread", hi: "थ्रेड खोलें" })}
									<ArrowUpRight size={15} aria-hidden="true" />
								</Link>
							</footer>
						</article>
					))}
				</section>
			) : (
				<p className="border-y border-[var(--line)] py-12 text-center text-[var(--ink-muted)]">
					{text({
						en: "No public posts match these filters.",
						hi: "इन फ़िल्टर से कोई सार्वजनिक पोस्ट नहीं मिली।",
					})}
				</p>
			)}
		</main>
	);
}

function Metric({
	label,
	value,
	note,
}: {
	label: string;
	value: string;
	note: string;
}) {
	return (
		<div className="border-b border-[var(--line)] py-5 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0 lg:border-b-0">
			<dt className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
				{label}
			</dt>
			<dd className="mt-2 text-2xl font-extrabold text-[var(--blue-950)]">
				{value}
			</dd>
			<dd className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{note}</dd>
		</div>
	);
}

function FeedSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: Array<{ value: string; label: string }>;
	onChange: (value: string) => void;
}) {
	return (
		<label className="text-xs font-bold text-[var(--blue-950)]">
			{label}
			<select
				className="mt-2 min-h-11 w-full border border-[var(--line-strong)] bg-[var(--paper)] px-3 text-sm outline-none focus:border-[var(--blue-700)]"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

export function PublicStatus({ status }: { status: string }) {
	const colour =
		status === "resolved" || status === "appeal_resolved"
			? "border-emerald-300 bg-emerald-50 text-emerald-900"
			: status === "needs_information"
				? "border-amber-300 bg-amber-50 text-amber-950"
				: status === "appealed"
					? "border-violet-300 bg-violet-50 text-violet-900"
					: "border-blue-300 bg-blue-50 text-blue-950";
	return (
		<span
			className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${colour}`}
		>
			{status.replaceAll("_", " ")}
		</span>
	);
}

function titleCase(value: string) {
	return value
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatWindow(startValue: string, endValue: string) {
	return `${formatDate(startValue)} to ${formatDate(endValue)}`;
}
