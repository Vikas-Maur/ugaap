export function formatMetric(value: number, unit: string) {
	if (unit === "percent") return `${value.toFixed(1)}%`;
	if (unit === "rating") return `${value.toFixed(2)} / 5`;
	if (unit === "hours") return `${value.toFixed(1)} h`;
	if (unit === "days") return `${value.toFixed(1)} d`;
	return value.toFixed(2);
}

export function supportingMetricSummary(
	metrics: Record<string, number | null>,
	unit: string,
) {
	if (
		metrics.standardDeviation !== undefined &&
		metrics.standardDeviation !== null
	)
		return `SD ${metrics.standardDeviation.toFixed(2)}`;
	if (metrics.p90 !== undefined && metrics.p90 !== null)
		return `P90 ${formatMetric(metrics.p90, unit)}`;
	if (metrics.medianAgeDays !== undefined && metrics.medianAgeDays !== null)
		return `Median open age ${metrics.medianAgeDays.toFixed(1)} d`;
	if (metrics.modifiedAppeals !== undefined && metrics.modifiedAppeals !== null)
		return `${metrics.modifiedAppeals} decisions modified`;
	if (
		metrics.partiallyResolved !== undefined &&
		metrics.partiallyResolved !== null
	)
		return `${metrics.partiallyResolved} partly resolved`;
	return "Supporting statistic unavailable";
}
