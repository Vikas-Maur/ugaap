import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import {
	ACCOUNTABILITY_METRIC_KEYS,
	ACCOUNTABILITY_METRIC_VERSION,
	ACCOUNTABILITY_METRICS,
	SATISFACTION_PRIOR_MEAN,
	SATISFACTION_PRIOR_RESPONSES,
} from "#/features/accountability/metrics";

export const Route = createFileRoute("/methodology")({
	component: MethodologyPage,
});

function MethodologyPage() {
	return (
		<main className="page-shell pb-32">
			<header className="border-b-2 border-[var(--blue-700)] pb-8">
				<p className="page-eyebrow">Accountability methodology</p>
				<h1 className="page-title mt-2">
					What each measure says, and what it does not
				</h1>
				<p className="page-intro max-w-4xl">
					There is no composite performance score. Authorities are compared
					separately on response, resolution, citizen outcomes, backlog, and
					appeal decisions.
				</p>
			</header>

			<section className="py-10" aria-labelledby="measure-definitions">
				<div className="flex flex-wrap items-baseline justify-between gap-3">
					<h2
						id="measure-definitions"
						className="text-2xl font-bold text-[var(--blue-950)]"
					>
						Measure definitions
					</h2>
					<p className="text-xs font-semibold text-[var(--ink-muted)]">
						Method version {ACCOUNTABILITY_METRIC_VERSION}
					</p>
				</div>
				<div className="mt-6 border-y border-[var(--line-strong)]">
					{ACCOUNTABILITY_METRIC_KEYS.map((key) => {
						const metric = ACCOUNTABILITY_METRICS[key];
						return (
							<article
								key={key}
								className="grid gap-3 border-t border-[var(--line)] px-3 py-6 first:border-t-0 md:grid-cols-[15rem_1fr_12rem] md:gap-7 md:px-4"
							>
								<div>
									<p className="text-xs font-bold uppercase tracking-wide text-[var(--ink-muted)]">
										{metric.group.replaceAll("_", " ")}
									</p>
									<h3 className="mt-1 font-bold text-[var(--blue-950)]">
										{metric.label}
									</h3>
								</div>
								<p className="text-sm leading-6 text-[var(--ink-muted)]">
									{metric.description}
								</p>
								<dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-1">
									<div>
										<dt className="font-bold text-[var(--blue-950)]">
											Better result
										</dt>
										<dd className="mt-1 text-[var(--ink-muted)]">
											{metric.direction === "lower"
												? "Lower value"
												: "Higher value"}
										</dd>
									</div>
									<div>
										<dt className="font-bold text-[var(--blue-950)]">
											Ranking threshold
										</dt>
										<dd className="mt-1 text-[var(--ink-muted)]">
											{metric.minimumSample} observations
										</dd>
									</div>
								</dl>
							</article>
						);
					})}
				</div>
			</section>

			<section className="grid gap-10 border-t border-[var(--line-strong)] py-10 lg:grid-cols-2">
				<div>
					<h2 className="text-xl font-bold text-[var(--blue-950)]">
						Citizen ratings
					</h2>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						The arithmetic average and rating spread are published. The ranking
						measure uses a Bayesian adjustment toward {SATISFACTION_PRIOR_MEAN}{" "}
						out of 5 with a prior weight of {SATISFACTION_PRIOR_RESPONSES}{" "}
						responses, so a handful of extreme ratings cannot dominate the
						table.
					</p>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						Dissatisfaction is the share of ratings scored 1 or 2. It is
						separate from the citizen’s direct answer about whether the
						grievance was resolved.
					</p>
				</div>
				<div>
					<h2 className="text-xl font-bold text-[var(--blue-950)]">
						Appeals and citizen resolution
					</h2>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						Appeal status tracks the workflow: filed, under review, resolved, or
						rejected. A resolved appeal also records whether the original
						decision was upheld, modified, or overturned.
					</p>
					<p className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
						A citizen can mark the result resolved, partially resolved, or not
						resolved. This assessment remains distinct from both the star rating
						and the department’s closure status.
					</p>
				</div>
			</section>

			<section
				className="grid gap-8 border-t border-[var(--line)] py-10 md:grid-cols-3"
				aria-label="Data safeguards"
			>
				<Rule
					title="Fixed windows"
					detail="Every result identifies a 30-day, 90-day, or one-year reporting window. Trends compare stored, versioned snapshots."
				/>
				<Rule
					title="Evidence before rank"
					detail="Values remain visible below the sample threshold, but the authority receives no rank for that measure."
				/>
				<Rule
					title="No double counting"
					detail="A public redacted copy does not create another official grievance or increase any denominator."
				/>
			</section>

			<Link
				className="inline-flex items-center gap-2 text-sm font-bold text-[var(--blue-800)] underline-offset-4 hover:underline"
				to="/accountability"
				search={{
					metric: "first_response_hours",
					group: "central",
					windowDays: 90,
				}}
			>
				Open accountability rankings <ArrowRight size={16} aria-hidden="true" />
			</Link>
		</main>
	);
}

function Rule({ title, detail }: { title: string; detail: string }) {
	return (
		<article className="border-l-4 border-[var(--blue-600)] pl-4">
			<h2 className="font-bold text-[var(--blue-950)]">{title}</h2>
			<p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{detail}</p>
		</article>
	);
}
