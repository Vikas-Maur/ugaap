export const LEADERBOARD_WINDOW_DAYS = 90;
export const MINIMUM_CLOSED_CASES = 20;
export const MINIMUM_RATINGS = 10;
export const SATISFACTION_PRIOR_RATINGS = 10;
export const SATISFACTION_PRIOR_MEAN = 3.5;

export const SCORE_WEIGHTS = {
	timelyResolution: 0.3,
	satisfaction: 0.25,
	backlogHealth: 0.2,
	appealQuality: 0.15,
	communicationTransparency: 0.1,
} as const;

export type LeaderboardRawMetrics = {
	closedCases: number;
	ratingCount: number;
	timelyClosedCases: number;
	reopenedCases: number;
	ratingSum: number;
	openCases: number;
	overdueOpenCases: number;
	decidedAppeals: number;
	upheldAppeals: number;
	casesWithMeaningfulUpdates: number;
	totalCases: number;
	publicCaseCount: number;
	privateCaseCount: number;
};

export type LeaderboardComputedMetrics = LeaderboardRawMetrics & {
	averageRating: number;
	timelyResolutionRate: number;
	reopenedRate: number;
	timelyResolutionScore: number;
	bayesianSatisfactionScore: number;
	backlogHealthScore: number;
	appealQualityScore: number;
	communicationTransparencyScore: number;
	compositeScore: number;
	grade: "A" | "B" | "C" | "D";
	eligible: boolean;
};

function clamp(value: number, minimum = 0, maximum = 100) {
	return Math.min(maximum, Math.max(minimum, value));
}

function percentage(
	numerator: number,
	denominator: number,
	emptyValue: number,
) {
	return denominator > 0 ? (numerator / denominator) * 100 : emptyValue;
}

function round(value: number, precision = 2) {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

export function gradeForScore(
	score: number,
): LeaderboardComputedMetrics["grade"] {
	if (score >= 80) return "A";
	if (score >= 65) return "B";
	if (score >= 50) return "C";
	return "D";
}

export function calculateLeaderboardScore(
	raw: LeaderboardRawMetrics,
): LeaderboardComputedMetrics {
	const timelyResolutionRate = percentage(
		raw.timelyClosedCases,
		raw.closedCases,
		0,
	);
	const reopenedRate = percentage(raw.reopenedCases, raw.closedCases, 0);
	const timelyResolutionScore = clamp(
		timelyResolutionRate * (1 - reopenedRate / 100),
	);
	const averageRating =
		raw.ratingCount > 0 ? raw.ratingSum / raw.ratingCount : 0;
	const shrunkRating =
		(raw.ratingSum + SATISFACTION_PRIOR_MEAN * SATISFACTION_PRIOR_RATINGS) /
		(raw.ratingCount + SATISFACTION_PRIOR_RATINGS);
	const bayesianSatisfactionScore = clamp(((shrunkRating - 1) / 4) * 100);
	const backlogHealthScore = clamp(
		100 - percentage(raw.overdueOpenCases, raw.openCases, 0),
	);
	const appealQualityScore = clamp(
		100 - percentage(raw.upheldAppeals, raw.decidedAppeals, 0),
	);
	const communicationTransparencyScore = clamp(
		percentage(raw.casesWithMeaningfulUpdates, raw.totalCases, 0),
	);
	const compositeScore =
		timelyResolutionScore * SCORE_WEIGHTS.timelyResolution +
		bayesianSatisfactionScore * SCORE_WEIGHTS.satisfaction +
		backlogHealthScore * SCORE_WEIGHTS.backlogHealth +
		appealQualityScore * SCORE_WEIGHTS.appealQuality +
		communicationTransparencyScore * SCORE_WEIGHTS.communicationTransparency;

	return {
		...raw,
		averageRating: round(averageRating),
		timelyResolutionRate: round(timelyResolutionRate),
		reopenedRate: round(reopenedRate),
		timelyResolutionScore: round(timelyResolutionScore),
		bayesianSatisfactionScore: round(bayesianSatisfactionScore),
		backlogHealthScore: round(backlogHealthScore),
		appealQualityScore: round(appealQualityScore),
		communicationTransparencyScore: round(communicationTransparencyScore),
		compositeScore: round(compositeScore),
		grade: gradeForScore(compositeScore),
		eligible:
			raw.closedCases >= MINIMUM_CLOSED_CASES &&
			raw.ratingCount >= MINIMUM_RATINGS,
	};
}

export function snapshotRawMetrics(
	metrics: LeaderboardComputedMetrics,
): Record<string, number> {
	return {
		closedCases: metrics.closedCases,
		ratingCount: metrics.ratingCount,
		timelyClosedCases: metrics.timelyClosedCases,
		reopenedCases: metrics.reopenedCases,
		ratingSum: metrics.ratingSum,
		openCases: metrics.openCases,
		overdueOpenCases: metrics.overdueOpenCases,
		decidedAppeals: metrics.decidedAppeals,
		upheldAppeals: metrics.upheldAppeals,
		casesWithMeaningfulUpdates: metrics.casesWithMeaningfulUpdates,
		totalCases: metrics.totalCases,
		publicCaseCount: metrics.publicCaseCount,
		privateCaseCount: metrics.privateCaseCount,
		averageRating: metrics.averageRating,
		timelyResolutionRate: metrics.timelyResolutionRate,
		reopenedRate: metrics.reopenedRate,
		timelyResolutionScore: metrics.timelyResolutionScore,
		bayesianSatisfactionScore: metrics.bayesianSatisfactionScore,
		backlogHealthScore: metrics.backlogHealthScore,
		appealQualityScore: metrics.appealQualityScore,
		communicationTransparencyScore: metrics.communicationTransparencyScore,
	};
}
