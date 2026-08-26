export const ACCOUNTABILITY_METRIC_VERSION = "1.0.0";
export const SATISFACTION_PRIOR_MEAN = 3.5;
export const SATISFACTION_PRIOR_RESPONSES = 10;

export const ACCOUNTABILITY_METRICS = {
	first_response_hours: {
		group: "response",
		label: "Time to first response",
		shortLabel: "First response",
		description:
			"Median hours from submission to the first recorded officer action.",
		unit: "hours",
		direction: "lower",
		minimumSample: 20,
	},
	resolution_days: {
		group: "resolution",
		label: "Time to resolution",
		shortLabel: "Resolution time",
		description:
			"Median days from submission to a substantive grievance closure.",
		unit: "days",
		direction: "lower",
		minimumSample: 20,
	},
	adjusted_rating: {
		group: "citizen_outcome",
		label: "Adjusted citizen rating",
		shortLabel: "Adjusted rating",
		description:
			"Average rating adjusted toward 3.5 out of 5 when an authority has few responses.",
		unit: "rating",
		direction: "higher",
		minimumSample: 10,
	},
	average_rating: {
		group: "citizen_outcome",
		label: "Average citizen rating",
		shortLabel: "Average rating",
		description: "Arithmetic mean of citizen ratings from 1 to 5.",
		unit: "rating",
		direction: "higher",
		minimumSample: 10,
	},
	dissatisfaction_rate: {
		group: "citizen_outcome",
		label: "Citizens dissatisfied",
		shortLabel: "Dissatisfaction",
		description: "Share of submitted ratings scored 1 or 2 out of 5.",
		unit: "percent",
		direction: "lower",
		minimumSample: 10,
	},
	citizen_unresolved_rate: {
		group: "citizen_outcome",
		label: "Citizens reporting no resolution",
		shortLabel: "Not resolved",
		description:
			"Share of feedback responses where the citizen said the grievance was not resolved.",
		unit: "percent",
		direction: "lower",
		minimumSample: 10,
	},
	old_backlog_rate: {
		group: "backlog",
		label: "Backlog older than 30 days",
		shortLabel: "Old backlog",
		description:
			"Share of open grievances that have remained open for more than 30 days.",
		unit: "percent",
		direction: "lower",
		minimumSample: 10,
	},
	appeal_overturn_rate: {
		group: "appeals",
		label: "Original decisions overturned",
		shortLabel: "Appeal overturns",
		description:
			"Share of decided appeals that overturned the original grievance decision.",
		unit: "percent",
		direction: "lower",
		minimumSample: 5,
	},
} as const;

export type AccountabilityMetricKey = keyof typeof ACCOUNTABILITY_METRICS;
export type AccountabilityMetricGroup =
	(typeof ACCOUNTABILITY_METRICS)[AccountabilityMetricKey]["group"];

export const ACCOUNTABILITY_METRIC_KEYS = Object.keys(
	ACCOUNTABILITY_METRICS,
) as AccountabilityMetricKey[];

export type AccountabilityCase = {
	id: string;
	submittedAt: Date;
	closedAt: Date | null;
	closureReason: string | null;
};

export type AccountabilityEvent = {
	grievanceId: string;
	actorType: string;
	createdAt: Date;
};

export type AccountabilityFeedback = {
	grievanceId: string;
	score: number;
	resolutionAssessment: "resolved" | "partially_resolved" | "not_resolved";
	createdAt: Date;
};

export type AccountabilityAppeal = {
	grievanceId: string;
	status: string;
	decisionOutcome:
		| "original_decision_upheld"
		| "original_decision_modified"
		| "original_decision_overturned"
		| null;
	resolvedAt: Date | null;
};

export type CalculatedAccountabilityMetric = {
	metricKey: AccountabilityMetricKey;
	value: number;
	sampleSize: number;
	numerator: number | null;
	denominator: number | null;
	eligible: boolean;
	supportingMetrics: Record<string, number | null>;
};

const HOUR = 60 * 60 * 1_000;
const DAY = 24 * HOUR;
const SUBSTANTIVE_CLOSURES = new Set([
	"citizen_confirmed",
	"department_action_unconfirmed",
	"appeal_decided",
]);

function round(value: number, precision = 2) {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
	return values.length
		? values.reduce((total, value) => total + value, 0) / values.length
		: 0;
}

function standardDeviation(values: number[]) {
	if (values.length < 2) return 0;
	const average = mean(values);
	const variance =
		values.reduce((total, value) => total + (value - average) ** 2, 0) /
		values.length;
	return Math.sqrt(variance);
}

function percentile(values: number[], percentileValue: number) {
	if (!values.length) return 0;
	const sorted = [...values].sort((left, right) => left - right);
	const position = (sorted.length - 1) * percentileValue;
	const lowerIndex = Math.floor(position);
	const upperIndex = Math.ceil(position);
	const lower = sorted[lowerIndex] ?? 0;
	const upper = sorted[upperIndex] ?? lower;
	return lower + (upper - lower) * (position - lowerIndex);
}

function percentage(numerator: number, denominator: number) {
	return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function inWindow(value: Date, windowStart: Date, windowEnd: Date) {
	return value >= windowStart && value <= windowEnd;
}

function metric(
	metricKey: AccountabilityMetricKey,
	value: number,
	sampleSize: number,
	options: {
		numerator?: number | null;
		denominator?: number | null;
		supportingMetrics?: Record<string, number | null>;
	} = {},
): CalculatedAccountabilityMetric {
	return {
		metricKey,
		value: round(value),
		sampleSize,
		numerator: options.numerator ?? null,
		denominator: options.denominator ?? null,
		eligible: sampleSize >= ACCOUNTABILITY_METRICS[metricKey].minimumSample,
		supportingMetrics: options.supportingMetrics ?? {},
	};
}

export function calculateAccountabilityMetrics(input: {
	cases: AccountabilityCase[];
	events: AccountabilityEvent[];
	feedback: AccountabilityFeedback[];
	appeals: AccountabilityAppeal[];
	windowStart: Date;
	windowEnd: Date;
}): CalculatedAccountabilityMetric[] {
	const caseById = new Map(input.cases.map((item) => [item.id, item]));
	const submittedCases = input.cases.filter((item) =>
		inWindow(item.submittedAt, input.windowStart, input.windowEnd),
	);
	const firstOfficerEventByCase = new Map<string, Date>();
	for (const event of input.events) {
		if (event.actorType !== "officer" || event.createdAt > input.windowEnd)
			continue;
		const item = caseById.get(event.grievanceId);
		if (!item || event.createdAt < item.submittedAt) continue;
		const current = firstOfficerEventByCase.get(event.grievanceId);
		if (!current || event.createdAt < current)
			firstOfficerEventByCase.set(event.grievanceId, event.createdAt);
	}
	const firstResponseHours = submittedCases.flatMap((item) => {
		const firstResponse = firstOfficerEventByCase.get(item.id);
		return firstResponse
			? [(firstResponse.getTime() - item.submittedAt.getTime()) / HOUR]
			: [];
	});

	const substantiveClosures = input.cases.filter(
		(item) =>
			item.closedAt !== null &&
			inWindow(item.closedAt, input.windowStart, input.windowEnd) &&
			item.closureReason !== null &&
			SUBSTANTIVE_CLOSURES.has(item.closureReason),
	);
	const resolutionDays = substantiveClosures.map(
		(item) =>
			((item.closedAt?.getTime() ?? item.submittedAt.getTime()) -
				item.submittedAt.getTime()) /
			DAY,
	);

	const feedback = input.feedback.filter((item) =>
		inWindow(item.createdAt, input.windowStart, input.windowEnd),
	);
	const ratings = feedback.map((item) => item.score);
	const ratingAverage = mean(ratings);
	const adjustedRating =
		(ratings.reduce((total, value) => total + value, 0) +
			SATISFACTION_PRIOR_MEAN * SATISFACTION_PRIOR_RESPONSES) /
		(ratings.length + SATISFACTION_PRIOR_RESPONSES);
	const dissatisfied = feedback.filter((item) => item.score <= 2).length;
	const unresolved = feedback.filter(
		(item) => item.resolutionAssessment === "not_resolved",
	).length;
	const partiallyResolved = feedback.filter(
		(item) => item.resolutionAssessment === "partially_resolved",
	).length;

	const openCases = input.cases.filter(
		(item) =>
			item.submittedAt <= input.windowEnd &&
			(item.closedAt === null || item.closedAt > input.windowEnd),
	);
	const oldBacklog = openCases.filter(
		(item) => input.windowEnd.getTime() - item.submittedAt.getTime() > 30 * DAY,
	).length;
	const backlogAges = openCases.map(
		(item) => (input.windowEnd.getTime() - item.submittedAt.getTime()) / DAY,
	);

	const decidedAppeals = input.appeals.filter(
		(item) =>
			item.status === "resolved" &&
			item.decisionOutcome !== null &&
			item.resolvedAt !== null &&
			inWindow(item.resolvedAt, input.windowStart, input.windowEnd),
	);
	const overturnedAppeals = decidedAppeals.filter(
		(item) => item.decisionOutcome === "original_decision_overturned",
	).length;
	const modifiedAppeals = decidedAppeals.filter(
		(item) => item.decisionOutcome === "original_decision_modified",
	).length;

	return [
		metric(
			"first_response_hours",
			percentile(firstResponseHours, 0.5),
			firstResponseHours.length,
			{
				denominator: submittedCases.length,
				supportingMetrics: {
					average: round(mean(firstResponseHours)),
					p90: round(percentile(firstResponseHours, 0.9)),
					responseCoverage: round(
						percentage(firstResponseHours.length, submittedCases.length),
					),
					withoutResponse: submittedCases.length - firstResponseHours.length,
				},
			},
		),
		metric(
			"resolution_days",
			percentile(resolutionDays, 0.5),
			resolutionDays.length,
			{
				supportingMetrics: {
					average: round(mean(resolutionDays)),
					p90: round(percentile(resolutionDays, 0.9)),
					within30Days: resolutionDays.filter((value) => value <= 30).length,
				},
			},
		),
		metric("adjusted_rating", adjustedRating, ratings.length, {
			denominator: ratings.length,
			supportingMetrics: {
				average: round(ratingAverage),
				standardDeviation: round(standardDeviation(ratings)),
				oneStar: ratings.filter((value) => value === 1).length,
				twoStar: ratings.filter((value) => value === 2).length,
				threeStar: ratings.filter((value) => value === 3).length,
				fourStar: ratings.filter((value) => value === 4).length,
				fiveStar: ratings.filter((value) => value === 5).length,
			},
		}),
		metric("average_rating", ratingAverage, ratings.length, {
			denominator: ratings.length,
			supportingMetrics: {
				adjustedAverage: round(adjustedRating),
				standardDeviation: round(standardDeviation(ratings)),
			},
		}),
		metric(
			"dissatisfaction_rate",
			percentage(dissatisfied, ratings.length),
			ratings.length,
			{
				numerator: dissatisfied,
				denominator: ratings.length,
				supportingMetrics: {
					averageRating: round(ratingAverage),
					standardDeviation: round(standardDeviation(ratings)),
				},
			},
		),
		metric(
			"citizen_unresolved_rate",
			percentage(unresolved, feedback.length),
			feedback.length,
			{
				numerator: unresolved,
				denominator: feedback.length,
				supportingMetrics: { partiallyResolved },
			},
		),
		metric(
			"old_backlog_rate",
			percentage(oldBacklog, openCases.length),
			openCases.length,
			{
				numerator: oldBacklog,
				denominator: openCases.length,
				supportingMetrics: {
					openCases: openCases.length,
					medianAgeDays: round(percentile(backlogAges, 0.5)),
					oldestAgeDays: round(Math.max(0, ...backlogAges)),
				},
			},
		),
		metric(
			"appeal_overturn_rate",
			percentage(overturnedAppeals, decidedAppeals.length),
			decidedAppeals.length,
			{
				numerator: overturnedAppeals,
				denominator: decidedAppeals.length,
				supportingMetrics: { modifiedAppeals },
			},
		),
	];
}
