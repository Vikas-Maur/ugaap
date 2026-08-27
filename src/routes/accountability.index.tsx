import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	ArrowUpDown,
	Minus,
	Search,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { z } from "zod";
import { ScrollArea } from "#/components/ui/scroll-area";
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

const highlightMetrics = [
	"adjusted_rating",
	"first_response_hours",
	"old_backlog_rate",
] as const;

const authorityPalette = [
	"#1d4ed8",
	"#047857",
	"#b45309",
	"#7e22ce",
	"#be123c",
	"#0369a1",
	"#3f6212",
	"#a21caf",
	"#c2410c",
	"#4338ca",
	"#0f766e",
	"#9f1239",
	"#6d28d9",
	"#1e40af",
	"#065f46",
	"#92400e",
	"#86198f",
	"#075985",
	"#4d7c0f",
	"#9d174d",
	"#5b21b6",
	"#155e75",
	"#b91c1c",
	"#3730a3",
	"#15803d",
	"#a16207",
	"#701a75",
	"#0c4a6e",
	"#65a30d",
	"#be185d",
	"#4c1d95",
	"#0e7490",
	"#991b1b",
	"#312e81",
	"#166534",
	"#854d0e",
	"#581c87",
	"#164e63",
	"#3a5f0b",
	"#831843",
	"#6b21a8",
	"#1e3a8a",
	"#14532d",
	"#7c2d12",
	"#7a1f5c",
	"#083344",
	"#365314",
	"#881337",
] as const;

function AccountabilityOverview() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const [query, setQuery] = useState("");
	const [sortKey, setSortKey] = useState<MetricKey>("adjusted_rating");
	const authorityColors = useMemo(
		() => assignAuthorityColors(data.entries),
		[data.entries],
	);
	const metricGroups = Object.entries(groupLabels).map(([key, label]) => ({
		key,
		label,
		metrics: data.metrics.filter((metric) => metric.group === key),
	}));
	const visibleEntries = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase("en-IN");
		return data.entries
			.filter((entry) =>
				normalizedQuery
					? `${entry.name} ${entry.jurisdiction}`
							.toLocaleLowerCase("en-IN")
							.includes(normalizedQuery)
					: true,
			)
			.sort((left, right) => {
				const leftRank =
					metricFor(left, sortKey)?.rank ?? Number.MAX_SAFE_INTEGER;
				const rightRank =
					metricFor(right, sortKey)?.rank ?? Number.MAX_SAFE_INTEGER;
				return leftRank - rightRank || left.name.localeCompare(right.name);
			});
	}, [data.entries, query, sortKey]);
	const sortDefinition = data.metrics.find((metric) => metric.key === sortKey);

	return (
		<main className="page-shell pb-32">
			<header className="border-b-2 border-[var(--blue-700)] pb-8">
				<p className="page-eyebrow">Public accountability</p>
				<h1 className="page-title mt-2">Authority performance, compared</h1>
				<p className="page-intro max-w-4xl">
					Compare response times, citizen outcomes, backlog, and appeal
					decisions. Every result includes its sample size and uses an
					independent rank.
				</p>
			</header>

			{data.methodology.synthetic ? (
				<p className="border-b border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-950">
					Demo data. These results come from synthetic grievance histories and
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
						States and departments
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

			<section className="py-9" aria-labelledby="highlights-heading">
				<SectionHeading
					eyebrow="At a glance"
					id="highlights-heading"
					title="Leading authorities by key measure"
				>
					Bars use the reported value. The order follows each measure's stated
					direction, so the strongest result appears first.
				</SectionHeading>

				<div className="mt-6 grid border-y border-[var(--line-strong)] lg:grid-cols-3">
					{highlightMetrics.map((highlight, index) => {
						const definition = data.metrics.find(
							(metric) => metric.key === highlight,
						);
						return definition ? (
							<LeaderboardChart
								key={highlight}
								authorityColors={authorityColors}
								className={
									index > 0
										? "border-t border-[var(--line)] lg:border-l lg:border-t-0"
										: ""
								}
								definition={definition}
								entries={data.entries}
							/>
						) : null;
					})}
				</div>
			</section>

			<section
				className="border-t border-[var(--line-strong)] py-9"
				aria-labelledby="leaderboard-heading"
			>
				<SectionHeading
					eyebrow="Full comparison"
					id="leaderboard-heading"
					title="Authority leaderboard"
				>
					Choose any metric to reorder the leaderboard. Authorities below the
					minimum sample stay visible but do not receive a rank.
				</SectionHeading>

				<div className="mt-6 flex flex-wrap items-center gap-3 border-y border-[var(--line)] bg-[var(--blue-50)]/45 px-3 py-3">
					<label className="relative min-w-64 flex-1 sm:max-w-md">
						<span className="sr-only">Filter authorities</span>
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
							size={16}
						/>
						<input
							className="h-10 w-full border border-[var(--line-strong)] bg-white pl-9 pr-3 text-sm text-[var(--blue-950)] outline-none focus:border-[var(--blue-700)] focus:ring-2 focus:ring-[var(--blue-200)]"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Filter authorities"
							type="search"
							value={query}
						/>
					</label>
					<label className="flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)]">
						Rank by
						<select
							className="h-10 border border-[var(--line-strong)] bg-white px-3 text-sm font-bold text-[var(--blue-950)] outline-none focus:border-[var(--blue-700)] focus:ring-2 focus:ring-[var(--blue-200)]"
							onChange={(event) => {
								const selected = data.metrics.find(
									(metric) => metric.key === event.target.value,
								);
								if (selected) setSortKey(selected.key);
							}}
							value={sortKey}
						>
							{data.metrics.map((metric) => (
								<option key={metric.key} value={metric.key}>
									{metric.shortLabel}
								</option>
							))}
						</select>
					</label>
					<span className="ml-auto text-xs tabular-nums text-[var(--ink-muted)]">
						{visibleEntries.length} of {data.entries.length} authorities
					</span>
				</div>

				<ScrollArea
					className="h-[min(72vh,760px)] border-b border-[var(--line-strong)]"
					scrollbars="both"
					type="always"
				>
					<div className="w-[1568px] pb-3 pr-3 md:w-[1680px]">
						<table className="w-full table-fixed border-collapse text-left text-sm">
							<thead className="sticky top-0 z-30 bg-slate-100 align-bottom text-[var(--ink-muted)] shadow-[0_1px_0_var(--line-strong)]">
								<tr>
									<th
										className="w-48 border-r border-[var(--line-strong)] bg-slate-100 px-3 py-4 md:sticky md:left-0 md:z-40 md:w-80 md:px-4"
										scope="col"
									>
										<span className="block text-[0.65rem] font-bold uppercase tracking-wide text-[var(--blue-700)]">
											Ranked by
										</span>
										<span className="mt-1 block font-extrabold text-[var(--blue-950)]">
											{sortDefinition?.shortLabel ?? "Selected measure"}
										</span>
									</th>
									{data.metrics.map((metric) => (
										<MetricHeader
											key={metric.key}
											metric={metric}
											selected={sortKey === metric.key}
											onSelect={() => setSortKey(metric.key)}
										/>
									))}
								</tr>
							</thead>
							<tbody>
								{visibleEntries.map((entry) => (
									<LeaderboardRow
										key={entry.id}
										definitions={data.metrics}
										entry={entry}
										authorityColor={
											authorityColors.get(entry.id) ?? authorityPalette[0]
										}
										sortKey={sortKey}
										windowDays={search.windowDays}
									/>
								))}
							</tbody>
						</table>
						{visibleEntries.length === 0 ? (
							<p className="py-14 text-center text-sm text-[var(--ink-muted)]">
								No authorities match this filter.
							</p>
						) : null}
					</div>
				</ScrollArea>
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
					The selected measure controls the row order. UGAAP does not combine
					unrelated results into one overall score.
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
type Entry = OverviewData["entries"][number];
type OverviewMetric = Entry["metrics"][number];
type MetricDefinition = OverviewData["metrics"][number];
type MetricKey = MetricDefinition["key"];

function metricFor(entry: Entry, key: MetricKey) {
	return entry.metrics.find((metric) => metric.key === key);
}

function assignAuthorityColors(entries: Entry[]) {
	const colors = new Map<string, string>();
	const used = new Set<number>();
	for (const entry of [...entries].sort((left, right) =>
		left.slug.localeCompare(right.slug),
	)) {
		let paletteIndex = stableHash(entry.slug) % authorityPalette.length;
		let attempts = 0;
		while (used.has(paletteIndex) && attempts < authorityPalette.length) {
			paletteIndex = (paletteIndex + 1) % authorityPalette.length;
			attempts += 1;
		}
		if (attempts < authorityPalette.length) {
			used.add(paletteIndex);
			colors.set(
				entry.id,
				authorityPalette[paletteIndex] ?? authorityPalette[0],
			);
		} else {
			colors.set(entry.id, `hsl(${stableHash(entry.id) % 360} 68% 32%)`);
		}
	}
	return colors;
}

function stableHash(value: string) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function SectionHeading({
	eyebrow,
	id,
	title,
	children,
}: {
	eyebrow: string;
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p className="page-eyebrow">{eyebrow}</p>
				<h2 id={id} className="mt-2 text-3xl font-bold text-[var(--blue-950)]">
					{title}
				</h2>
			</div>
			<p className="max-w-xl text-xs leading-5 text-[var(--ink-muted)]">
				{children}
			</p>
		</div>
	);
}

function LeaderboardChart({
	entries,
	definition,
	authorityColors,
	className,
}: {
	entries: Entry[];
	definition: MetricDefinition;
	authorityColors: Map<string, string>;
	className: string;
}) {
	const ranked = entries
		.flatMap((entry) => {
			const metric = metricFor(entry, definition.key);
			return metric?.rank ? [{ entry, metric }] : [];
		})
		.sort((left, right) => (left.metric.rank ?? 0) - (right.metric.rank ?? 0))
		.slice(0, 8);
	const maximum = Math.max(
		1,
		...ranked.map((item) => item.metric.current.value),
	);

	return (
		<figure className={`px-5 py-6 ${className}`}>
			<figcaption>
				<h3 className="flex items-center gap-3 text-xl font-extrabold text-[var(--blue-950)]">
					<span
						aria-hidden="true"
						className="h-5 w-1 shrink-0 bg-[var(--blue-700)]"
					/>
					{definition.shortLabel}
				</h3>
				<p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
					{definition.description}{" "}
					<span className="font-bold text-[var(--blue-900)]">
						{definition.direction === "lower"
							? "Lower is better."
							: "Higher is better."}
					</span>
				</p>
			</figcaption>

			{ranked.length ? (
				<>
					<div
						className="mt-5 grid h-56 items-end gap-2 border-b border-[var(--line-strong)] px-2 pt-5"
						style={{
							gridTemplateColumns: `repeat(${ranked.length}, minmax(0, 1fr))`,
							backgroundImage:
								"repeating-linear-gradient(to bottom, transparent 0, transparent 54px, var(--line) 55px)",
						}}
					>
						{ranked.map((item) => {
							const height = 18 + (item.metric.current.value / maximum) * 72;
							const authorityColor =
								authorityColors.get(item.entry.id) ?? authorityPalette[0];
							return (
								<div
									key={item.entry.id}
									className="relative flex min-w-0 items-start justify-center"
									style={{
										height: `${height}%`,
										backgroundColor: authorityColor,
									}}
									title={`${item.entry.name}: ${formatMetric(item.metric.current.value, definition.unit)}`}
								>
									<span className="mt-2 text-[0.68rem] font-black tabular-nums text-white">
										{formatChartMetric(
											item.metric.current.value,
											definition.unit,
										)}
									</span>
								</div>
							);
						})}
					</div>
					<ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
						{ranked.map((item) => (
							<li
								key={item.entry.id}
								className="flex min-w-0 gap-2 text-[0.68rem] leading-4 text-[var(--ink-muted)]"
							>
								<span
									aria-hidden="true"
									className="mt-1 size-2 shrink-0"
									style={{
										backgroundColor:
											authorityColors.get(item.entry.id) ?? authorityPalette[0],
									}}
								/>
								<span className="font-black tabular-nums text-[var(--blue-800)]">
									{item.metric.rank}.
								</span>
								<span className="truncate" title={item.entry.name}>
									{item.entry.name}
								</span>
							</li>
						))}
					</ol>
				</>
			) : (
				<p className="mt-6 border-y border-[var(--line)] py-16 text-center text-sm text-[var(--ink-muted)]">
					No authority meets the sample threshold.
				</p>
			)}
		</figure>
	);
}

function formatChartMetric(value: number, unit: string) {
	if (unit === "percent") return `${value.toFixed(1)}%`;
	if (unit === "rating") return value.toFixed(2);
	if (unit === "hours") return `${value.toFixed(1)}h`;
	if (unit === "days") return `${value.toFixed(1)}d`;
	return value.toFixed(2);
}

function MetricHeader({
	metric,
	selected,
	onSelect,
}: {
	metric: MetricDefinition;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<th
			className={`w-[172px] border-l px-4 py-4 md:w-[170px] ${selected ? "border-l-2 border-[var(--blue-700)] bg-blue-50" : "border-[var(--line)]"}`}
			scope="col"
		>
			<button
				className="group/header w-full text-left"
				onClick={onSelect}
				type="button"
			>
				<span className="block text-[0.65rem] font-bold uppercase tracking-wide text-[var(--blue-700)]">
					{groupLabels[metric.group]}
				</span>
				<span className="mt-1 flex items-center justify-between gap-2 text-sm font-extrabold leading-5 text-[var(--blue-950)] group-hover/header:text-[var(--blue-700)]">
					{metric.shortLabel}
					<ArrowUpDown
						aria-hidden="true"
						className={selected ? "text-[var(--blue-700)]" : "text-slate-400"}
						size={14}
					/>
				</span>
				<span className="mt-2 block text-[0.68rem] font-medium normal-case leading-4">
					{metric.direction === "lower"
						? "Lower is better"
						: "Higher is better"}
					, minimum n={metric.minimumSample}
				</span>
			</button>
		</th>
	);
}

function LeaderboardRow({
	entry,
	authorityColor,
	definitions,
	sortKey,
	windowDays,
}: {
	entry: Entry;
	authorityColor: string;
	definitions: MetricDefinition[];
	sortKey: MetricKey;
	windowDays: 30 | 90 | 365;
}) {
	const selectedMetric = metricFor(entry, sortKey);
	return (
		<tr className="group border-t border-[var(--line)] align-top hover:bg-[var(--blue-50)]/55">
			<th
				className="w-48 border-r border-[var(--line-strong)] bg-[var(--paper)] px-3 py-4 group-hover:bg-[var(--blue-50)] md:sticky md:left-0 md:z-20 md:w-80 md:px-4"
				scope="row"
			>
				<div className="flex items-start gap-2 md:gap-3">
					<span
						className={`mt-0.5 min-w-6 text-center text-lg font-black tabular-nums md:min-w-8 ${selectedMetric?.rank ? "text-[var(--blue-700)]" : "text-slate-400"}`}
					>
						{selectedMetric?.rank ?? "-"}
					</span>
					<span
						className="min-w-0 border-l-4 pl-2 md:pl-3"
						style={{ borderColor: authorityColor }}
					>
						<Link
							className="break-words font-bold leading-5 text-[var(--blue-950)] underline-offset-4 hover:underline"
							to="/accountability/authorities/$authoritySlug"
							params={{ authoritySlug: entry.slug }}
							search={{ windowDays }}
						>
							{entry.name}
						</Link>
						<span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">
							{entry.jurisdiction}
						</span>
					</span>
				</div>
			</th>
			{definitions.map((definition) => (
				<MetricCell
					key={definition.key}
					definition={definition}
					metric={metricFor(entry, definition.key)}
					selected={sortKey === definition.key}
				/>
			))}
		</tr>
	);
}

function MetricCell({
	metric,
	definition,
	selected,
}: {
	metric: OverviewMetric | undefined;
	definition: MetricDefinition;
	selected: boolean;
}) {
	const cellClass = selected
		? "border-l-2 border-[var(--blue-700)] bg-blue-50/70"
		: "border-l border-[var(--line)]";
	if (!metric || metric.current.sampleSize === 0)
		return (
			<td className={`${cellClass} px-4 py-4 text-xs text-[var(--ink-muted)]`}>
				No data
			</td>
		);
	return (
		<td className={`${cellClass} px-4 py-4 tabular-nums`}>
			<span className="block text-base font-extrabold text-[var(--blue-900)]">
				{formatMetric(metric.current.value, definition.unit)}
			</span>
			<span
				className={`mt-1 block text-xs font-bold ${metric.rank ? "text-[var(--blue-800)]" : "text-amber-800"}`}
			>
				{metric.rank ? `Rank ${metric.rank}` : "Not ranked"}, n=
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
