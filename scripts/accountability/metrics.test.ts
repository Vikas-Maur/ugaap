import assert from "node:assert/strict";
import test from "node:test";

import { calculateAccountabilityMetrics } from "../../src/features/accountability/metrics.ts";

const DAY = 24 * 60 * 60 * 1_000;
const HOUR = 60 * 60 * 1_000;
const end = new Date("2026-08-23T12:00:00.000Z");
const start = new Date(end.getTime() - 90 * DAY);

test("calculates response and resolution medians from eligible events and closures", () => {
	const cases = [
		{ id: "a", submittedAt: new Date(start.getTime() + DAY), closedAt: new Date(start.getTime() + 11 * DAY), closureReason: "citizen_confirmed" },
		{ id: "b", submittedAt: new Date(start.getTime() + 2 * DAY), closedAt: new Date(start.getTime() + 22 * DAY), closureReason: "department_action_unconfirmed" },
		{ id: "c", submittedAt: new Date(start.getTime() + 3 * DAY), closedAt: new Date(start.getTime() + 8 * DAY), closureReason: "withdrawn_by_citizen" },
	];
	const result = calculateAccountabilityMetrics({
		cases,
		events: [
			{ grievanceId: "a", actorType: "citizen", createdAt: new Date(cases[0].submittedAt.getTime() + HOUR) },
			{ grievanceId: "a", actorType: "officer", createdAt: new Date(cases[0].submittedAt.getTime() + 8 * HOUR) },
			{ grievanceId: "b", actorType: "officer", createdAt: new Date(cases[1].submittedAt.getTime() + 16 * HOUR) },
		],
		feedback: [],
		appeals: [],
		windowStart: start,
		windowEnd: end,
	});
	assert.equal(result.find((metric) => metric.metricKey === "first_response_hours")?.value, 12);
	assert.equal(result.find((metric) => metric.metricKey === "resolution_days")?.value, 15);
});

test("keeps ratings, dissatisfaction, and resolution assessment as separate measures", () => {
	const result = calculateAccountabilityMetrics({
		cases: [],
		events: [],
		feedback: [
			{ grievanceId: "a", score: 1, resolutionAssessment: "partially_resolved", createdAt: end },
			{ grievanceId: "b", score: 4, resolutionAssessment: "not_resolved", createdAt: end },
			{ grievanceId: "c", score: 5, resolutionAssessment: "resolved", createdAt: end },
		],
		appeals: [],
		windowStart: start,
		windowEnd: end,
	});
	assert.equal(result.find((metric) => metric.metricKey === "average_rating")?.value, 3.33);
	assert.equal(result.find((metric) => metric.metricKey === "dissatisfaction_rate")?.value, 33.33);
	assert.equal(result.find((metric) => metric.metricKey === "citizen_unresolved_rate")?.value, 33.33);
	assert.notEqual(result.find((metric) => metric.metricKey === "adjusted_rating")?.value, 3.33);
});

test("counts only decided appeals with a recorded outcome", () => {
	const result = calculateAccountabilityMetrics({
		cases: [],
		events: [],
		feedback: [],
		appeals: [
			{ grievanceId: "a", status: "resolved", decisionOutcome: "original_decision_overturned", resolvedAt: end },
			{ grievanceId: "b", status: "resolved", decisionOutcome: "original_decision_upheld", resolvedAt: end },
			{ grievanceId: "c", status: "filed", decisionOutcome: null, resolvedAt: null },
		],
		windowStart: start,
		windowEnd: end,
	});
	const metric = result.find((item) => item.metricKey === "appeal_overturn_rate");
	assert.equal(metric?.value, 50);
	assert.equal(metric?.sampleSize, 2);
});
