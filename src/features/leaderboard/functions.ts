import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq } from "drizzle-orm";

import { db } from "#/db/index";
import { organization, performanceSnapshot } from "#/db/schema";
import {
	calculateLeaderboardScore,
	LEADERBOARD_WINDOW_DAYS,
	type LeaderboardComputedMetrics,
	type LeaderboardRawMetrics,
	MINIMUM_CLOSED_CASES,
	MINIMUM_RATINGS,
	SATISFACTION_PRIOR_MEAN,
	SATISFACTION_PRIOR_RATINGS,
	SCORE_WEIGHTS,
} from "./scoring";

type RankingGroup = "central" | "state";

type SnapshotRow = {
	organization: typeof organization.$inferSelect;
	snapshot: typeof performanceSnapshot.$inferSelect;
};

function numberMetric(metrics: Record<string, number>, key: string) {
	const value = metrics[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rawMetrics(metrics: Record<string, number>): LeaderboardRawMetrics {
	return {
		closedCases: numberMetric(metrics, "closedCases"),
		ratingCount: numberMetric(metrics, "ratingCount"),
		timelyClosedCases: numberMetric(metrics, "timelyClosedCases"),
		reopenedCases: numberMetric(metrics, "reopenedCases"),
		ratingSum: numberMetric(metrics, "ratingSum"),
		openCases: numberMetric(metrics, "openCases"),
		overdueOpenCases: numberMetric(metrics, "overdueOpenCases"),
		decidedAppeals: numberMetric(metrics, "decidedAppeals"),
		upheldAppeals: numberMetric(metrics, "upheldAppeals"),
		casesWithMeaningfulUpdates: numberMetric(
			metrics,
			"casesWithMeaningfulUpdates",
		),
		totalCases: numberMetric(metrics, "totalCases"),
		publicCaseCount: numberMetric(metrics, "publicCaseCount"),
		privateCaseCount: numberMetric(metrics, "privateCaseCount"),
	};
}

function rankingGroup(row: SnapshotRow["organization"]): RankingGroup {
	if (row.type === "state" || row.type === "state_department") return "state";
	return "central";
}

function setPublicHeaders() {
	return import("@tanstack/react-start/server").then(
		({ setResponseHeader }) => {
			setResponseHeader("Cache-Control", "no-store");
			setResponseHeader("X-Content-Type-Options", "nosniff");
		},
	);
}

function rankGroup(
	items: Array<{
		row: SnapshotRow["organization"];
		current: SnapshotRow["snapshot"];
		previous: SnapshotRow["snapshot"] | null;
		metrics: LeaderboardComputedMetrics;
		previousMetrics: LeaderboardComputedMetrics | null;
	}>,
) {
	const eligibleCurrent = [...items]
		.filter((item) => item.metrics.eligible)
		.sort(
			(left, right) =>
				right.metrics.compositeScore - left.metrics.compositeScore ||
				left.row.name.localeCompare(right.row.name),
		);
	const eligiblePrevious = [...items]
		.filter((item) => item.previousMetrics?.eligible)
		.sort(
			(left, right) =>
				(right.previousMetrics?.compositeScore ?? 0) -
					(left.previousMetrics?.compositeScore ?? 0) ||
				left.row.name.localeCompare(right.row.name),
		);
	const rankById = new Map(
		eligibleCurrent.map((item, index) => [item.row.id, index + 1]),
	);
	const previousRankById = new Map(
		eligiblePrevious.map((item, index) => [item.row.id, index + 1]),
	);

	return [...items]
		.sort((left, right) => {
			const leftRank = rankById.get(left.row.id);
			const rightRank = rankById.get(right.row.id);
			if (leftRank && rightRank) return leftRank - rightRank;
			if (leftRank) return -1;
			if (rightRank) return 1;
			return left.row.name.localeCompare(right.row.name);
		})
		.map((item) => {
			const rank = rankById.get(item.row.id) ?? null;
			const previousRank = previousRankById.get(item.row.id) ?? null;
			return {
				id: item.row.id,
				slug: item.row.slug,
				name: item.row.name,
				type: item.row.type,
				jurisdiction: item.row.jurisdiction,
				rank,
				previousRank,
				rankChange:
					rank !== null && previousRank !== null ? previousRank - rank : null,
				score: item.metrics.compositeScore,
				previousScore: item.previousMetrics?.compositeScore ?? null,
				scoreChange: item.previousMetrics
					? Math.round(
							(item.metrics.compositeScore -
								item.previousMetrics.compositeScore) *
								100,
						) / 100
					: null,
				grade: item.metrics.grade,
				eligible: item.metrics.eligible,
				metrics: item.metrics,
				windowStart: item.current.windowStart.toISOString(),
				windowEnd: item.current.windowEnd.toISOString(),
			};
		});
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
	async () => {
		await setPublicHeaders();
		const rows = await db
			.select({ organization, snapshot: performanceSnapshot })
			.from(performanceSnapshot)
			.innerJoin(
				organization,
				eq(organization.id, performanceSnapshot.organizationId),
			)
			.where(eq(organization.active, true))
			.orderBy(
				asc(organization.id),
				desc(performanceSnapshot.windowEnd),
				desc(performanceSnapshot.createdAt),
			);

		const byOrganization = new Map<string, SnapshotRow[]>();
		for (const row of rows) {
			const existing = byOrganization.get(row.organization.id) ?? [];
			if (existing.length < 2) existing.push(row);
			byOrganization.set(row.organization.id, existing);
		}

		const entries = [...byOrganization.values()].flatMap((snapshots) => {
			const current = snapshots[0];
			if (!current) return [];
			const previous = snapshots[1] ?? null;
			return [
				{
					row: current.organization,
					current: current.snapshot,
					previous: previous?.snapshot ?? null,
					metrics: calculateLeaderboardScore(
						rawMetrics(current.snapshot.rawMetrics),
					),
					previousMetrics: previous
						? calculateLeaderboardScore(
								rawMetrics(previous.snapshot.rawMetrics),
							)
						: null,
				},
			];
		});

		return {
			central: rankGroup(
				entries.filter((entry) => rankingGroup(entry.row) === "central"),
			),
			state: rankGroup(
				entries.filter((entry) => rankingGroup(entry.row) === "state"),
			),
			methodology: {
				windowDays: LEADERBOARD_WINDOW_DAYS,
				minimumClosedCases: MINIMUM_CLOSED_CASES,
				minimumRatings: MINIMUM_RATINGS,
				satisfactionPriorMean: SATISFACTION_PRIOR_MEAN,
				satisfactionPriorRatings: SATISFACTION_PRIOR_RATINGS,
				weights: SCORE_WEIGHTS,
				synthetic: entries.some((entry) =>
					entry.row.source.startsWith("synthetic-seed"),
				),
			},
		};
	},
);
