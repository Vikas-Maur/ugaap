import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

import { getAccountabilityOverview } from "#/features/accountability/functions";
import { ACCOUNTABILITY_METRIC_KEYS } from "#/features/accountability/metrics";

const searchSchema = z.object({
	metric: z.enum(ACCOUNTABILITY_METRIC_KEYS).catch("first_response_hours"),
	group: z.enum(["central", "state"]).catch("central"),
	windowDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).catch(90),
});

export const Route = createFileRoute("/accountability/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getAccountabilityOverview({ data: deps }),
	component: AccountabilityOverview,
});

const groupLabels = {
	response: "Response",
	resolution: "Resolution",
	citizen_outcome: "Citizen outcomes",
	backlog: "Backlog",
	appeals: "Appeals",
} as const;

function AccountabilityOverview() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const metricGroups = Object.entries(groupLabels).map(([key, label]) => ({
		key,
		label,
		metrics: data.metrics.filter((metric) => metric.group === key),
	}));

	return (
		<main className="page-shell pb-32">
			<header className="border-b-2 border-[var(--blue-700)] pb-8">
				<p className="page-eyebrow">Public accountability</p>
				<h1 className="page-title mt-2">
					Authority performance, measure by measure
				</h1>
				<p className="page-intro max-w-4xl">
					Compare response time, resolution time, citizen outcomes, backlog, and
					appeal decisions. Each measure has its own ranking, evidence
					threshold, and trend.
				</p>
			</header>

			{data.methodology.synthetic ? (
				<p className="border-b border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-950">
					Demo data: these results are generated from synthetic grievance
					histories and do not describe real government performance.
				</p>
			) : null}

			<section
				className="border-b border-[var(--line-strong)] py-7"
				aria-labelledby="measure-heading"
			>
				<div className="grid gap-7 lg:grid-cols-[13rem_minmax(0,1fr)]">
					<div>
						<h2
							id="measure-heading"
							className="text-sm font-extrabold uppercase tracking-[0.08em] text-[var(--blue-950)]"
						>
							Choose a measure
						</h2>
						<p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
							Rankings are never blended into one opaque score.
						</p>
					</div>
					<div className="space-y-5">
						{metricGroups.map((group) => (
							<div
								key={group.key}
								className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start"
							>
								<p className="pt-2 text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">
									{group.label}
								</p>
								<div className="flex flex-wrap gap-x-5 gap-y-1">
									{group.metrics.map((metric) => (
										<Link
											key={metric.key}
											className={`border-b-2 px-1 py-2 text-sm font-bold no-underline ${search.metric === metric.key ? "border-[var(--blue-700)] text-[var(--blue-950)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--blue-800)]"}`}
											to="/accountability"
											search={{ ...search, metric: metric.key }}
										>
											{metric.shortLabel}
										</Link>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			<div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line)] py-6">
				<nav className="flex gap-7" aria-label="Authority group">
					<FilterLink
						active={search.group === "central"}
						search={{ ...search, group: "central" }}
					>
						Central authorities
					</FilterLink>
					<FilterLink
						active={search.group === "state"}
						search={{ ...search, group: "state" }}
					>
						States and state departments
					</FilterLink>
				</nav>
				<nav className="flex gap-2" aria-label="Reporting window">
					{([30, 90, 365] as const).map((windowDays) => (
						<Link
							key={windowDays}
							className={`border px-3 py-2 text-xs font-bold no-underline ${search.windowDays === windowDays ? "border-[var(--blue-700)] bg-[var(--blue-700)] text-white" : "border-[var(--line-strong)] text-[var(--blue-900)] hover:bg-[var(--blue-50)]"}`}
							to="/accountability"
							search={{ ...search, windowDays }}
						>
							{windowDays === 365 ? "1 year" : `${windowDays} days`}
						</Link>
					))}
				</nav>
			</div>

			<section className="py-8" aria-labelledby="ranking-title">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="page-eyebrow">Selected measure</p>
						<h2
							id="ranking-title"
							className="mt-2 text-3xl font-bold text-[var(--blue-950)]"
						>
							{data.metric.label}
						</h2>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
							{data.metric.description}
						</p>
					</div>
					<p className="text-xs font-semibold text-[var(--ink-muted)]">
						Minimum sample: {data.methodology.minimumSample}
					</p>
				</div>

				<div className="mt-6 overflow-x-auto border-y border-[var(--line-strong)]">
					<table className="w-full min-w-[840px] border-collapse text-left text-sm">
						<thead className="bg-[var(--blue-50)] text-xs uppercase tracking-[0.06em] text-[var(--ink-muted)]">
							<tr>
								<th className="w-20 px-4 py-3" scope="col">
									Rank
								</th>
								<th className="min-w-72 px-4 py-3" scope="col">
									Authority
								</th>
								<th className="px-4 py-3" scope="col">
									{data.metric.shortLabel}
								</th>
								<th className="px-4 py-3" scope="col">
									Sample
								</th>
								<th className="px-4 py-3" scope="col">
									Previous window
								</th>
								<th className="px-4 py-3" scope="col">
									Change
								</th>
							</tr>
						</thead>
						<tbody>
							{data.entries.map((entry) => (
								<tr
									key={entry.id}
									className="border-t border-[var(--line)] hover:bg-[var(--blue-50)]/55"
								>
									<td className="px-4 py-4 font-extrabold tabular-nums text-[var(--blue-950)]">
										{entry.rank ?? (
											<span className="text-xs font-semibold text-[var(--ink-muted)]">
												Not ranked
											</span>
										)}
									</td>
									<th className="px-4 py-4" scope="row">
										<Link
											className="font-bold text-[var(--blue-950)] underline-offset-4 hover:underline"
											to="/accountability/authorities/$authoritySlug"
											params={{ authoritySlug: entry.slug }}
											search={{ windowDays: search.windowDays }}
										>
											{entry.name}
										</Link>
										<span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">
											{entry.jurisdiction}
										</span>
										{!entry.current.eligible ? (
											<span className="mt-1 block text-xs font-bold text-amber-800">
												Insufficient evidence for a rank
											</span>
										) : null}
									</th>
									<td className="px-4 py-4 text-base font-extrabold tabular-nums text-[var(--blue-900)]">
										{formatMetric(entry.current.value, data.metric.unit)}
									</td>
									<td className="px-4 py-4 tabular-nums">
										{entry.current.sampleSize}
									</td>
									<td className="px-4 py-4 tabular-nums text-[var(--ink-muted)]">
										{entry.previousValue === null
											? "Not available"
											: formatMetric(entry.previousValue, data.metric.unit)}
									</td>
									<td className="px-4 py-4">
										<Change
											value={entry.change}
											direction={data.metric.direction}
											unit={data.metric.unit}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{data.entries.length === 0 ? (
					<p className="border-b border-[var(--line)] py-10 text-center text-sm text-[var(--ink-muted)]">
						No authorities have data for this group and window.
					</p>
				) : null}
			</section>

			<footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line-strong)] py-8">
				<p className="max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
					Ranks only compare authorities that meet this measure’s sample
					threshold. Unranked results remain visible.
				</p>
				<Link
					className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
					to="/methodology"
				>
					Read the methodology <ArrowRight size={16} aria-hidden="true" />
				</Link>
			</footer>
		</main>
	);
}

function FilterLink({
	active,
	search,
	children,
}: {
	active: boolean;
	search: z.infer<typeof searchSchema>;
	children: ReactNode;
}) {
	return (
		<Link
			className={`border-b-2 pb-2 text-sm font-bold no-underline ${active ? "border-[var(--blue-700)] text-[var(--blue-950)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--blue-800)]"}`}
			to="/accountability"
			search={search}
		>
			{children}
		</Link>
	);
}

function formatMetric(value: number, unit: string) {
	if (unit === "percent") return `${value.toFixed(1)}%`;
	if (unit === "rating") return `${value.toFixed(2)} / 5`;
	if (unit === "hours") return `${value.toFixed(1)} h`;
	if (unit === "days") return `${value.toFixed(1)} d`;
	return value.toFixed(2);
}

function Change({
	value,
	direction,
	unit,
}: {
	value: number | null;
	direction: "lower" | "higher";
	unit: string;
}) {
	if (value === null)
		return (
			<span className="text-xs text-[var(--ink-muted)]">Not available</span>
		);
	if (value === 0)
		return (
			<span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ink-muted)]">
				<Minus size={14} aria-hidden="true" /> No change
			</span>
		);
	const improved = direction === "lower" ? value < 0 : value > 0;
	const Icon = value > 0 ? ArrowUp : ArrowDown;
	return (
		<span
			className={`inline-flex items-center gap-1 text-xs font-bold ${improved ? "text-emerald-800" : "text-red-800"}`}
		>
			<Icon size={14} aria-hidden="true" />
			{formatMetric(Math.abs(value), unit)} {improved ? "better" : "worse"}
		</span>
	);
}

export { formatMetric };
