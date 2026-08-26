import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import {
	formatMetric,
	supportingMetricSummary,
} from "#/features/accountability/format";
import { getAccountabilityOverview } from "#/features/accountability/functions";

const searchSchema = z.object({
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
				<h1 className="page-title mt-2">Compare every performance measure</h1>
				<p className="page-intro max-w-4xl">
					Response, resolution, citizen outcomes, backlog, and appeal results
					are shown together. Each column still has its own rank and evidence
					threshold.
				</p>
			</header>

			{data.methodology.synthetic ? (
				<p className="border-b border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-950">
					Demo data: these results come from synthetic grievance histories and
					do not describe real government performance.
				</p>
			) : null}

			<div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--line-strong)] py-6">
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

			<section className="py-8" aria-labelledby="comparison-heading">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="page-eyebrow">Side-by-side results</p>
						<h2
							id="comparison-heading"
							className="mt-2 text-3xl font-bold text-[var(--blue-950)]"
						>
							Authority comparison matrix
						</h2>
					</div>
					<p className="max-w-xl text-xs leading-5 text-[var(--ink-muted)]">
						A rank appears only when the authority meets that column’s sample
						threshold. Scroll the matrix horizontally on smaller screens.
					</p>
				</div>

				<div className="mt-6 overflow-x-auto border-y border-[var(--line-strong)]">
					<table className="w-full min-w-[1680px] border-collapse text-left text-sm">
						<thead className="bg-[var(--blue-50)] align-bottom text-[var(--ink-muted)]">
							<tr>
								<th
									className="sticky left-0 z-20 min-w-72 border-r border-[var(--line-strong)] bg-[var(--blue-50)] px-4 py-4"
									scope="col"
								>
									<span className="text-xs font-extrabold uppercase tracking-[0.07em]">
										Authority
									</span>
								</th>
								{data.metrics.map((metric) => (
									<th
										key={metric.key}
										className="min-w-44 border-l border-[var(--line)] px-4 py-4"
										scope="col"
									>
										<span className="block text-[0.65rem] font-bold uppercase tracking-wide text-[var(--blue-700)]">
											{groupLabels[metric.group]}
										</span>
										<span className="mt-1 block text-sm font-extrabold leading-5 text-[var(--blue-950)]">
											{metric.shortLabel}
										</span>
										<span className="mt-2 block text-[0.68rem] font-medium normal-case leading-4">
											{metric.direction === "lower"
												? "Lower is better"
												: "Higher is better"}{" "}
											· min n={metric.minimumSample}
										</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{data.entries.map((entry) => (
								<tr
									key={entry.id}
									className="group border-t border-[var(--line)] align-top hover:bg-[var(--blue-50)]/55"
								>
									<th
										className="sticky left-0 z-10 border-r border-[var(--line-strong)] bg-[var(--paper)] px-4 py-5 group-hover:bg-[var(--blue-50)]"
										scope="row"
									>
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
									</th>
									{data.metrics.map((definition) => {
										const metric = entry.metrics.find(
											(item) => item.key === definition.key,
										);
										return (
											<MetricCell
												key={definition.key}
												metric={metric}
												definition={definition}
											/>
										);
									})}
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

			<section
				className="border-t border-[var(--line-strong)] py-8"
				aria-labelledby="measure-guide"
			>
				<h2
					id="measure-guide"
					className="text-2xl font-bold text-[var(--blue-950)]"
				>
					What the columns measure
				</h2>
				<div className="mt-5 grid border-y border-[var(--line)] md:grid-cols-2 xl:grid-cols-5">
					{metricGroups.map((group, index) => (
						<div
							key={group.key}
							className={`border-b border-[var(--line)] px-4 py-5 xl:border-b-0 ${index > 0 ? "md:border-l" : ""}`}
						>
							<h3 className="font-extrabold text-[var(--blue-950)]">
								{group.label}
							</h3>
							<ul className="mt-3 space-y-3">
								{group.metrics.map((metric) => (
									<li
										key={metric.key}
										className="text-xs leading-5 text-[var(--ink-muted)]"
									>
										<span className="font-bold text-[var(--blue-900)]">
											{metric.shortLabel}.
										</span>{" "}
										{metric.description}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>

			<footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line-strong)] py-8">
				<p className="max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
					There is no overall rank. A strong response-time result cannot hide
					weak citizen outcomes or a high appeal overturn rate.
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

type OverviewData = Awaited<ReturnType<typeof getAccountabilityOverview>>;
type OverviewMetric = OverviewData["entries"][number]["metrics"][number];
type MetricDefinition = OverviewData["metrics"][number];

function MetricCell({
	metric,
	definition,
}: {
	metric: OverviewMetric | undefined;
	definition: MetricDefinition;
}) {
	if (!metric || metric.current.sampleSize === 0)
		return (
			<td className="border-l border-[var(--line)] px-4 py-5 text-xs text-[var(--ink-muted)]">
				No data
			</td>
		);
	return (
		<td className="border-l border-[var(--line)] px-4 py-5 tabular-nums">
			<span className="block text-base font-extrabold text-[var(--blue-900)]">
				{formatMetric(metric.current.value, definition.unit)}
			</span>
			<span
				className={`mt-1 block text-xs font-bold ${metric.rank ? "text-[var(--blue-800)]" : "text-amber-800"}`}
			>
				{metric.rank ? `Rank ${metric.rank}` : "Not ranked"} · n=
				{metric.current.sampleSize}
			</span>
			<span className="mt-2 block text-[0.68rem] text-[var(--ink-muted)]">
				{supportingMetricSummary(
					metric.current.supportingMetrics,
					definition.unit,
				)}
			</span>
			<span className="mt-2 block">
				<Change
					value={metric.change}
					direction={definition.direction}
					unit={definition.unit}
				/>
			</span>
		</td>
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
			<span className="text-[0.68rem] text-[var(--ink-muted)]">
				No prior period
			</span>
		);
	if (value === 0)
		return (
			<span className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-[var(--ink-muted)]">
				<Minus size={12} aria-hidden="true" /> No change
			</span>
		);
	const improved = direction === "lower" ? value < 0 : value > 0;
	const Icon = value > 0 ? ArrowUp : ArrowDown;
	return (
		<span
			className={`inline-flex items-center gap-1 text-[0.68rem] font-bold ${improved ? "text-emerald-800" : "text-red-800"}`}
		>
			<Icon size={12} aria-hidden="true" />
			{formatMetric(Math.abs(value), unit)} {improved ? "better" : "worse"}
		</span>
	);
}
