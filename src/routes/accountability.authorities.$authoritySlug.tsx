import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { getAuthorityAccountabilityProfile } from "#/features/accountability/functions";
import { formatMetric } from "./accountability.index";

const searchSchema = z.object({
	windowDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).catch(90),
});

export const Route = createFileRoute(
	"/accountability/authorities/$authoritySlug",
)({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ params, deps }) =>
		getAuthorityAccountabilityProfile({
			data: { slug: params.authoritySlug, windowDays: deps.windowDays },
		}),
	component: AuthorityProfile,
});

function AuthorityProfile() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const categoryRows = new Map<
		string,
		{
			name: string;
			metrics: Map<string, (typeof data.categories)[number]["metric"]>;
		}
	>();
	for (const row of data.categories) {
		const categoryId = row.categoryId;
		if (!categoryId) continue;
		const current = categoryRows.get(categoryId) ?? {
			name: row.categoryName,
			metrics: new Map(),
		};
		current.metrics.set(row.metric.metricKey, row.metric);
		categoryRows.set(categoryId, current);
	}

	return (
		<main className="page-shell pb-32">
			<Link
				className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
				to="/accountability"
				search={{
					metric: "first_response_hours",
					group:
						data.authority.type === "state" ||
						data.authority.type === "state_department"
							? "state"
							: "central",
					windowDays: search.windowDays,
				}}
			>
				<ArrowLeft size={16} aria-hidden="true" /> Accountability rankings
			</Link>
			<header className="mt-8 border-b-2 border-[var(--blue-700)] pb-8">
				<p className="page-eyebrow">Authority profile</p>
				<h1 className="page-title mt-2">{data.authority.name}</h1>
				<p className="mt-3 text-sm font-semibold text-[var(--ink-muted)]">
					{data.authority.jurisdiction} ·{" "}
					{data.authority.type.replaceAll("_", " ")}
				</p>
			</header>

			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] py-5">
				<p className="text-sm text-[var(--ink-muted)]">
					Each measure is calculated independently. Version {data.metricVersion}
					.
				</p>
				<nav className="flex gap-2" aria-label="Reporting window">
					{([30, 90, 365] as const).map((windowDays) => (
						<Link
							key={windowDays}
							className={`border px-3 py-2 text-xs font-bold no-underline ${search.windowDays === windowDays ? "border-[var(--blue-700)] bg-[var(--blue-700)] text-white" : "border-[var(--line-strong)] text-[var(--blue-900)] hover:bg-[var(--blue-50)]"}`}
							to="/accountability/authorities/$authoritySlug"
							params={{ authoritySlug: data.authority.slug }}
							search={{ windowDays }}
						>
							{windowDays === 365 ? "1 year" : `${windowDays} days`}
						</Link>
					))}
				</nav>
			</div>

			<section className="py-8" aria-labelledby="profile-measures">
				<h2
					id="profile-measures"
					className="text-2xl font-bold text-[var(--blue-950)]"
				>
					Performance measures and trends
				</h2>
				<div className="mt-5 grid border-y border-[var(--line-strong)] md:grid-cols-2">
					{data.metrics.map((metric, index) => (
						<article
							key={metric.key}
							className={`border-b border-[var(--line)] px-4 py-6 md:px-6 ${index % 2 === 1 ? "md:border-l" : ""}`}
						>
							<div className="flex items-start justify-between gap-4">
								<div>
									<p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">
										{metric.group.replaceAll("_", " ")}
									</p>
									<h3 className="mt-1 font-bold text-[var(--blue-950)]">
										{metric.label}
									</h3>
								</div>
								<p className="text-2xl font-extrabold tabular-nums text-[var(--blue-800)]">
									{formatMetric(metric.current.value, metric.unit)}
								</p>
							</div>
							<p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
								{metric.description}
							</p>
							<Trend values={metric.trend.map((point) => point.value)} />
							<div className="mt-3 flex items-center justify-between text-xs font-semibold text-[var(--ink-muted)]">
								<span>Sample {metric.current.sampleSize}</span>
								<span>
									{metric.current.eligible
										? "Eligible for ranking"
										: "Below ranking threshold"}
								</span>
							</div>
						</article>
					))}
				</div>
			</section>

			<section
				className="border-t border-[var(--line-strong)] py-8"
				aria-labelledby="category-heading"
			>
				<h2
					id="category-heading"
					className="text-2xl font-bold text-[var(--blue-950)]"
				>
					Service category breakdown
				</h2>
				<p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
					Categories belong only to this authority. Values are shown where the
					category has evidence in the selected window.
				</p>
				<div className="mt-6 overflow-x-auto border-y border-[var(--line-strong)]">
					<table className="w-full min-w-[980px] border-collapse text-left text-sm">
						<thead className="bg-[var(--blue-50)] text-xs uppercase tracking-wide text-[var(--ink-muted)]">
							<tr>
								<th className="px-4 py-3">Category</th>
								{data.metrics.map((metric) => (
									<th key={metric.key} className="px-4 py-3">
										{metric.shortLabel}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...categoryRows.entries()].map(([id, row]) => (
								<tr key={id} className="border-t border-[var(--line)]">
									<th
										className="px-4 py-4 font-bold text-[var(--blue-950)]"
										scope="row"
									>
										{row.name}
									</th>
									{data.metrics.map((definition) => {
										const metric = row.metrics.get(definition.key);
										return (
											<td
												key={definition.key}
												className="px-4 py-4 tabular-nums"
											>
												{metric ? (
													<>
														<span className="font-semibold">
															{formatMetric(metric.value, definition.unit)}
														</span>
														<span className="mt-1 block text-xs text-[var(--ink-muted)]">
															n={metric.sampleSize}
														</span>
													</>
												) : (
													"Not available"
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{categoryRows.size === 0 ? (
					<p className="border-b border-[var(--line)] py-8 text-sm text-[var(--ink-muted)]">
						No category-level evidence is available for this window.
					</p>
				) : null}
			</section>
		</main>
	);
}

function Trend({ values }: { values: number[] }) {
	if (values.length < 2)
		return (
			<div className="mt-5 flex h-14 items-center border-y border-[var(--line)] text-xs text-[var(--ink-muted)]">
				More reporting periods are needed for a trend.
			</div>
		);
	const width = 360;
	const height = 56;
	const minimum = Math.min(...values);
	const maximum = Math.max(...values);
	const spread = maximum - minimum || 1;
	const points = values
		.map(
			(value, index) =>
				`${(index / (values.length - 1)) * width},${height - 6 - ((value - minimum) / spread) * (height - 12)}`,
		)
		.join(" ");
	return (
		<div className="mt-5 border-y border-[var(--line)] py-2">
			<svg
				className="h-14 w-full"
				viewBox={`0 0 ${width} ${height}`}
				role="img"
				aria-label={`Trend across ${values.length} reporting periods`}
				preserveAspectRatio="none"
			>
				<polyline
					points={points}
					fill="none"
					stroke="var(--blue-700)"
					strokeWidth="3"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		</div>
	);
}
