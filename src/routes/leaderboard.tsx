import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	Check,
	Minus,
	Plus,
} from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { text, useI18n } from "../features/i18n/i18n";
import { getLeaderboard } from "../features/leaderboard/functions";

const leaderboardSearchSchema = z.object({
	group: z.enum(["central", "state"]).catch("central"),
	compare: z.string().max(600).catch(""),
});

type LeaderboardData = Awaited<ReturnType<typeof getLeaderboard>>;
type LeaderboardEntry = LeaderboardData["central"][number];

export const Route = createFileRoute("/leaderboard")({
	validateSearch: leaderboardSearchSchema,
	loader: () => getLeaderboard(),
	component: LeaderboardPage,
});

function LeaderboardPage() {
	const { text: translate } = useI18n();
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const ranking = search.group === "central" ? data.central : data.state;
	const allEntries = [...data.central, ...data.state];
	const allowedSlugs = new Set(allEntries.map((entry) => entry.slug));
	const comparedSlugs = search.compare
		.split(",")
		.filter((slug, index, slugs) =>
			Boolean(slug && allowedSlugs.has(slug) && slugs.indexOf(slug) === index),
		)
		.slice(0, 3);
	const compared = comparedSlugs.flatMap((slug) => {
		const entry = allEntries.find((candidate) => candidate.slug === slug);
		return entry ? [entry] : [];
	});

	function toggleComparison(slug: string) {
		const selected = comparedSlugs.includes(slug);
		const next = selected
			? comparedSlugs.filter((candidate) => candidate !== slug)
			: [...comparedSlugs, slug].slice(0, 3);
		void navigate({
			search: (previous) => ({ ...previous, compare: next.join(",") }),
		});
	}

	return (
		<main className="page-shell pb-32">
			<header className="border-b border-[var(--line-strong)] pb-8">
				<p className="page-eyebrow">
					{translate(
						text({ en: "Public accountability", hi: "सार्वजनिक जवाबदेही" }),
					)}
				</p>
				<h1 className="page-title">
					{translate(
						text({
							en: "Government service leaderboard",
							hi: "सरकारी सेवा रैंकिंग",
						}),
					)}
				</h1>
				<p className="page-intro max-w-3xl">
					{translate(
						text({
							en: "A rolling 90-day comparison that rewards timely, useful resolutions and makes weak samples visible instead of turning them into misleading ranks.",
							hi: "यह 90 दिनों की तुलना समय पर उपयोगी समाधान को महत्व देती है और छोटे नमूनों को भ्रामक रैंक देने के बजाय स्पष्ट दिखाती है।",
						}),
					)}
				</p>
			</header>

			{data.methodology.synthetic ? (
				<p className="border-b border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-950">
					{translate(
						text({
							en: "Methodology demo. Every score and case count on this page is synthetic and does not describe real government performance.",
							hi: "कार्यप्रणाली डेमो। इस पृष्ठ के सभी अंक और मामले कृत्रिम हैं तथा वास्तविक सरकारी प्रदर्शन नहीं दर्शाते।",
						}),
					)}
				</p>
			) : null}

			<nav
				className="mt-8 flex gap-7 border-b border-[var(--line)]"
				aria-label="Leaderboard group"
			>
				<GroupLink
					active={search.group === "central"}
					group="central"
					compare={search.compare}
				>
					{translate(text({ en: "Central Government", hi: "केंद्र सरकार" }))}
				</GroupLink>
				<GroupLink
					active={search.group === "state"}
					group="state"
					compare={search.compare}
				>
					{translate(
						text({ en: "States and UTs", hi: "राज्य और केंद्र शासित प्रदेश" }),
					)}
				</GroupLink>
			</nav>

			<div className="mt-6 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-[var(--blue-950)]">
						{search.group === "central"
							? translate(
									text({
										en: "Central Government bodies",
										hi: "केंद्र सरकार के निकाय",
									}),
								)
							: translate(
									text({
										en: "State and UT bodies",
										hi: "राज्य और केंद्र शासित प्रदेश के निकाय",
									}),
								)}
					</h2>
					<p className="mt-1 text-sm text-[var(--ink-muted)]">
						{translate(
							text({
								en: `Ranked bodies need at least ${data.methodology.minimumClosedCases} closed cases and ${data.methodology.minimumRatings} citizen ratings.`,
								hi: `रैंक के लिए कम से कम ${data.methodology.minimumClosedCases} बंद मामले और ${data.methodology.minimumRatings} नागरिक रेटिंग चाहिए।`,
							}),
						)}
					</p>
				</div>
				<p className="text-sm font-semibold text-[var(--blue-900)]">
					{compared.length}/3{" "}
					{translate(
						text({ en: "selected to compare", hi: "तुलना के लिए चुने गए" }),
					)}
				</p>
			</div>

			<RankingTable
				entries={ranking}
				comparedSlugs={comparedSlugs}
				onToggleComparison={toggleComparison}
			/>

			<section
				className="mt-14 border-y border-[var(--line-strong)] py-8"
				aria-labelledby="comparison-title"
			>
				<div className="flex flex-wrap items-baseline justify-between gap-3">
					<div>
						<p className="page-eyebrow">
							{translate(text({ en: "Side by side", hi: "साथ-साथ" }))}
						</p>
						<h2
							id="comparison-title"
							className="mt-2 text-2xl font-bold text-[var(--blue-950)]"
						>
							{translate(
								text({
									en: "Compare up to three bodies",
									hi: "तीन निकायों तक तुलना करें",
								}),
							)}
						</h2>
					</div>
					{compared.length ? (
						<button
							className="text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
							type="button"
							onClick={() =>
								void navigate({
									search: (previous) => ({ ...previous, compare: "" }),
								})
							}
						>
							{translate(text({ en: "Clear comparison", hi: "तुलना हटाएं" }))}
						</button>
					) : null}
				</div>
				{compared.length ? (
					<ComparisonTable entries={compared} />
				) : (
					<p className="mt-6 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
						{translate(
							text({
								en: "Use the Compare controls in either ranking. Your selection stays here when you switch between Central and State/UT results.",
								hi: "किसी भी रैंकिंग में तुलना बटन चुनें। केंद्र और राज्य परिणामों के बीच बदलने पर आपका चयन यहीं रहेगा।",
							}),
						)}
					</p>
				)}
			</section>

			<MethodSummary data={data} />
		</main>
	);
}

function GroupLink({
	active,
	group,
	compare,
	children,
}: {
	active: boolean;
	group: "central" | "state";
	compare: string;
	children: ReactNode;
}) {
	return (
		<Link
			className={`border-b-2 px-1 pb-3 text-sm font-bold no-underline ${active ? "border-[var(--blue-700)] text-[var(--blue-900)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--blue-800)]"}`}
			to="/leaderboard"
			search={{ group, compare }}
		>
			{children}
		</Link>
	);
}

function RankingTable({
	entries,
	comparedSlugs,
	onToggleComparison,
}: {
	entries: LeaderboardEntry[];
	comparedSlugs: string[];
	onToggleComparison: (slug: string) => void;
}) {
	const { text: translate } = useI18n();
	return (
		<div className="mt-6 overflow-x-auto border-y border-[var(--line-strong)]">
			<table className="w-full min-w-[980px] border-collapse text-left text-sm">
				<thead className="bg-[var(--blue-50)] text-xs uppercase tracking-[0.06em] text-[var(--ink-muted)]">
					<tr>
						<th className="w-20 px-4 py-3" scope="col">
							{translate(text({ en: "Rank", hi: "रैंक" }))}
						</th>
						<th className="min-w-64 px-4 py-3" scope="col">
							{translate(text({ en: "Government body", hi: "सरकारी निकाय" }))}
						</th>
						<th className="px-4 py-3" scope="col">
							{translate(text({ en: "Score", hi: "अंक" }))}
						</th>
						<th className="px-4 py-3" scope="col">
							{translate(text({ en: "Grade", hi: "ग्रेड" }))}
						</th>
						<th className="px-4 py-3" scope="col">
							{translate(text({ en: "Closed", hi: "बंद" }))}
						</th>
						<th className="px-4 py-3" scope="col">
							{translate(text({ en: "Ratings", hi: "रेटिंग" }))}
						</th>
						<th className="px-4 py-3" scope="col">
							{translate(text({ en: "Trend", hi: "रुझान" }))}
						</th>
						<th className="px-4 py-3 text-right" scope="col">
							{translate(text({ en: "Compare", hi: "तुलना" }))}
						</th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => {
						const selected = comparedSlugs.includes(entry.slug);
						const comparisonFull = comparedSlugs.length >= 3 && !selected;
						return (
							<tr
								key={entry.id}
								className="border-t border-[var(--line)] align-middle hover:bg-[var(--blue-50)]/50"
							>
								<td className="px-4 py-4 font-extrabold text-[var(--blue-950)]">
									{entry.rank ?? (
										<span className="text-xs font-semibold text-[var(--ink-muted)]">
											{translate(text({ en: "Not ranked", hi: "रैंक नहीं" }))}
										</span>
									)}
								</td>
								<th className="px-4 py-4" scope="row">
									<span className="block font-bold text-[var(--blue-950)]">
										{entry.name}
									</span>
									<span className="mt-1 block text-xs font-normal text-[var(--ink-muted)]">
										{entry.jurisdiction}
									</span>
									{!entry.eligible ? (
										<span className="mt-1 block text-xs font-semibold text-amber-800">
											{translate(
												text({ en: "Insufficient data", hi: "अपर्याप्त डेटा" }),
											)}
										</span>
									) : null}
								</th>
								<td className="px-4 py-4 font-bold tabular-nums">
									{entry.eligible ? entry.score.toFixed(2) : "—"}
								</td>
								<td className="px-4 py-4">
									<Grade grade={entry.grade} eligible={entry.eligible} />
								</td>
								<td className="px-4 py-4 tabular-nums">
									{entry.metrics.closedCases}
								</td>
								<td className="px-4 py-4 tabular-nums">
									{entry.metrics.ratingCount}
								</td>
								<td className="px-4 py-4">
									<Trend change={entry.scoreChange} eligible={entry.eligible} />
								</td>
								<td className="px-4 py-4 text-right">
									<button
										className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold ${selected ? "border-[var(--blue-700)] bg-[var(--blue-700)] text-white" : "border-[var(--line-strong)] text-[var(--blue-900)] hover:bg-[var(--blue-50)]"}`}
										type="button"
										disabled={comparisonFull}
										aria-pressed={selected}
										onClick={() => onToggleComparison(entry.slug)}
									>
										{selected ? (
											<Check size={14} aria-hidden="true" />
										) : (
											<Plus size={14} aria-hidden="true" />
										)}
										{selected
											? translate(text({ en: "Added", hi: "जोड़ा गया" }))
											: translate(text({ en: "Add", hi: "जोड़ें" }))}
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function ComparisonTable({ entries }: { entries: LeaderboardEntry[] }) {
	const { text: translate } = useI18n();
	const rows = [
		[
			translate(text({ en: "Composite score", hi: "कुल अंक" })),
			(entry: LeaderboardEntry) =>
				entry.eligible
					? entry.score.toFixed(2)
					: translate(text({ en: "Insufficient data", hi: "अपर्याप्त डेटा" })),
		],
		[
			translate(text({ en: "Timely resolution", hi: "समय पर समाधान" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.timelyResolutionScore.toFixed(1)}%`,
		],
		[
			translate(text({ en: "Adjusted satisfaction", hi: "समायोजित संतुष्टि" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.bayesianSatisfactionScore.toFixed(1)}%`,
		],
		[
			translate(text({ en: "Backlog health", hi: "लंबित मामलों की स्थिति" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.backlogHealthScore.toFixed(1)}%`,
		],
		[
			translate(text({ en: "Appeal quality", hi: "अपील गुणवत्ता" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.appealQualityScore.toFixed(1)}%`,
		],
		[
			translate(text({ en: "Communication coverage", hi: "संचार कवरेज" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.communicationTransparencyScore.toFixed(1)}%`,
		],
		[
			translate(text({ en: "Average rating", hi: "औसत रेटिंग" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.averageRating.toFixed(2)} / 5`,
		],
		[
			translate(text({ en: "Official cases", hi: "आधिकारिक मामले" })),
			(entry: LeaderboardEntry) => String(entry.metrics.totalCases),
		],
		[
			translate(text({ en: "Public / private", hi: "सार्वजनिक / निजी" })),
			(entry: LeaderboardEntry) =>
				`${entry.metrics.publicCaseCount} / ${entry.metrics.privateCaseCount}`,
		],
	] as const;
	return (
		<div className="mt-6 overflow-x-auto">
			<table className="w-full min-w-[680px] border-collapse text-sm">
				<thead>
					<tr className="border-b border-[var(--line)]">
						<th
							className="w-52 px-3 py-3 text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]"
							scope="col"
						>
							{translate(text({ en: "Metric", hi: "मापदंड" }))}
						</th>
						{entries.map((entry) => (
							<th
								key={entry.id}
								className="min-w-48 px-3 py-3 text-left text-sm font-bold text-[var(--blue-950)]"
								scope="col"
							>
								{entry.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(([label, value]) => (
						<tr key={label} className="border-b border-[var(--line)]">
							<th
								className="px-3 py-3 text-left text-xs font-semibold text-[var(--ink-muted)]"
								scope="row"
							>
								{label}
							</th>
							{entries.map((entry) => (
								<td
									key={entry.id}
									className="px-3 py-3 font-semibold tabular-nums text-[var(--ink)]"
								>
									{value(entry)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function MethodSummary({ data }: { data: LeaderboardData }) {
	const { text: translate } = useI18n();
	const weights = [
		["30%", translate(text({ en: "Timely resolution", hi: "समय पर समाधान" }))],
		[
			"25%",
			translate(
				text({
					en: "Adjusted citizen satisfaction",
					hi: "समायोजित नागरिक संतुष्टि",
				}),
			),
		],
		[
			"20%",
			translate(text({ en: "Backlog health", hi: "लंबित मामलों की स्थिति" })),
		],
		["15%", translate(text({ en: "Appeal quality", hi: "अपील गुणवत्ता" }))],
		[
			"10%",
			translate(
				text({ en: "Communication transparency", hi: "संचार पारदर्शिता" }),
			),
		],
	] as const;
	return (
		<section className="py-12" aria-labelledby="formula-title">
			<p className="page-eyebrow">
				{translate(text({ en: "How the score works", hi: "अंक कैसे बनते हैं" }))}
			</p>
			<h2
				id="formula-title"
				className="mt-2 text-2xl font-bold text-[var(--blue-950)]"
			>
				{translate(
					text({ en: "One formula, visible inputs", hi: "एक सूत्र, स्पष्ट आंकड़े" }),
				)}
			</h2>
			<div className="mt-6 grid border-y border-[var(--line-strong)] sm:grid-cols-2 lg:grid-cols-5">
				{weights.map(([weight, label]) => (
					<div
						key={label}
						className="border-b border-[var(--line)] px-4 py-5 sm:border-l sm:first:border-l-0 lg:border-b-0"
					>
						<p className="text-2xl font-extrabold text-[var(--blue-800)]">
							{weight}
						</p>
						<p className="mt-1 text-sm font-semibold leading-5 text-[var(--ink)]">
							{label}
						</p>
					</div>
				))}
			</div>
			<p className="mt-6 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
				{translate(
					text({
						en: "Scores use every official grievance in the window, whether its redacted public copy exists or the case remains private. A public copy is a visibility setting, not a second case. Poor ratings lower satisfaction, reopened cases reduce timely-resolution credit, ageing open cases reduce backlog health, and citizen appeals upheld against the original resolution reduce appeal quality.",
						hi: "अंक अवधि के हर आधिकारिक मामले का उपयोग करते हैं, चाहे उसकी संपादित सार्वजनिक प्रति हो या मामला निजी रहे। सार्वजनिक प्रति दूसरा मामला नहीं है। खराब रेटिंग, दोबारा खुले मामले, पुराने लंबित मामले और नागरिक के पक्ष में स्वीकार अपील अंक घटाते हैं।",
					}),
				)}
			</p>
			<p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
				{translate(
					text({
						en: `Citizen satisfaction uses Bayesian adjustment toward ${data.methodology.satisfactionPriorMean.toFixed(1)} stars with a ${data.methodology.satisfactionPriorRatings}-rating prior. This limits extreme scores from very small samples.`,
						hi: `नागरिक संतुष्टि को ${data.methodology.satisfactionPriorMean.toFixed(1)} स्टार और ${data.methodology.satisfactionPriorRatings} रेटिंग के पूर्व मान की ओर समायोजित किया जाता है, ताकि छोटे नमूने अत्यधिक अंक न दें।`,
					}),
				)}
			</p>
			<Link
				className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
				to="/methodology"
			>
				{translate(
					text({ en: "Read the full methodology", hi: "पूरी कार्यप्रणाली पढ़ें" }),
				)}
				<ArrowRight size={16} aria-hidden="true" />
			</Link>
		</section>
	);
}

function Grade({ grade, eligible }: { grade: string; eligible: boolean }) {
	if (!eligible) return <span className="text-[var(--ink-muted)]">—</span>;
	const colour =
		grade === "A"
			? "border-emerald-300 bg-emerald-50 text-emerald-900"
			: grade === "B"
				? "border-blue-300 bg-blue-50 text-blue-950"
				: grade === "C"
					? "border-amber-300 bg-amber-50 text-amber-950"
					: "border-red-300 bg-red-50 text-red-900";
	return (
		<span
			className={`inline-flex min-w-8 justify-center rounded-full border px-2 py-1 text-xs font-extrabold ${colour}`}
		>
			{grade}
		</span>
	);
}

function Trend({
	change,
	eligible,
}: {
	change: number | null;
	eligible: boolean;
}) {
	if (!eligible || change === null)
		return (
			<span className="inline-flex items-center gap-1 text-xs text-[var(--ink-muted)]">
				<Minus size={14} aria-hidden="true" /> New
			</span>
		);
	if (change > 0)
		return (
			<span className="inline-flex items-center gap-1 font-bold text-emerald-800">
				<ArrowUp size={14} aria-hidden="true" />+{change.toFixed(2)}
			</span>
		);
	if (change < 0)
		return (
			<span className="inline-flex items-center gap-1 font-bold text-red-800">
				<ArrowDown size={14} aria-hidden="true" />
				{change.toFixed(2)}
			</span>
		);
	return (
		<span className="inline-flex items-center gap-1 text-[var(--ink-muted)]">
			<Minus size={14} aria-hidden="true" />
			0.00
		</span>
	);
}
