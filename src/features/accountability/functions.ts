import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index";
import {
	accountabilityMetricSnapshot,
	categoryNode,
	organization,
} from "#/db/schema";
import {
	ACCOUNTABILITY_METRIC_KEYS,
	ACCOUNTABILITY_METRIC_VERSION,
	ACCOUNTABILITY_METRICS,
	type AccountabilityMetricKey,
} from "./metrics";

const windowDaysSchema = z.union([
	z.literal(30),
	z.literal(90),
	z.literal(365),
]);
const overviewSchema = z
	.object({
		group: z.enum(["central", "state"]),
		windowDays: windowDaysSchema,
	})
	.strict();
const profileSchema = z
	.object({
		slug: z.string().trim().min(1).max(160),
		windowDays: windowDaysSchema,
	})
	.strict();

type Snapshot = typeof accountabilityMetricSnapshot.$inferSelect;
type Organization = typeof organization.$inferSelect;

function setPublicAnalyticsHeaders() {
	return import("@tanstack/react-start/server").then(
		({ setResponseHeader }) => {
			setResponseHeader(
				"Cache-Control",
				"public, max-age=60, s-maxage=300, stale-while-revalidate=900",
			);
			setResponseHeader("X-Content-Type-Options", "nosniff");
		},
	);
}

function rankingGroup(row: Organization) {
	return row.type === "state" || row.type === "state_department"
		? "state"
		: "central";
}

function serializeSnapshot(row: Snapshot) {
	return {
		metricKey: row.metricKey as AccountabilityMetricKey,
		metricVersion: row.metricVersion,
		windowDays: row.windowDays,
		windowStart: row.windowStart.toISOString(),
		windowEnd: row.windowEnd.toISOString(),
		value: Number(row.value),
		sampleSize: row.sampleSize,
		numerator: row.numerator,
		denominator: row.denominator,
		eligible: row.eligible,
		supportingMetrics: row.supportingMetrics,
		sourceKind: row.sourceKind,
	};
}

export const getAccountabilityOverview = createServerFn({ method: "GET" })
	.validator(overviewSchema)
	.handler(async ({ data }) => {
		await setPublicAnalyticsHeaders();
		const rows = await db
			.select({ snapshot: accountabilityMetricSnapshot, organization })
			.from(accountabilityMetricSnapshot)
			.innerJoin(
				organization,
				eq(organization.id, accountabilityMetricSnapshot.organizationId),
			)
			.where(
				and(
					eq(accountabilityMetricSnapshot.windowDays, data.windowDays),
					eq(
						accountabilityMetricSnapshot.metricVersion,
						ACCOUNTABILITY_METRIC_VERSION,
					),
					isNull(accountabilityMetricSnapshot.categoryNodeId),
					eq(organization.active, true),
				),
			)
			.orderBy(
				asc(organization.id),
				asc(accountabilityMetricSnapshot.metricKey),
				desc(accountabilityMetricSnapshot.windowEnd),
			);

		const byOrganization = new Map<
			string,
			{
				organization: Organization;
				byMetric: Map<AccountabilityMetricKey, Array<(typeof rows)[number]>>;
			}
		>();
		for (const row of rows) {
			if (rankingGroup(row.organization) !== data.group) continue;
			const metricKey = row.snapshot.metricKey as AccountabilityMetricKey;
			if (!ACCOUNTABILITY_METRIC_KEYS.includes(metricKey)) continue;
			const authority = byOrganization.get(row.organization.id) ?? {
				organization: row.organization,
				byMetric: new Map(),
			};
			const items = authority.byMetric.get(metricKey) ?? [];
			items.push(row);
			authority.byMetric.set(metricKey, items);
			byOrganization.set(row.organization.id, authority);
		}

		const entries = [...byOrganization.values()]
			.map(({ organization: authority, byMetric }) => ({
				id: authority.id,
				slug: authority.slug,
				name: authority.name,
				type: authority.type,
				jurisdiction: authority.jurisdiction,
				metrics: ACCOUNTABILITY_METRIC_KEYS.flatMap((metricKey) => {
					const snapshots = byMetric.get(metricKey) ?? [];
					const current = snapshots[0];
					if (!current) return [];
					const previous = snapshots.find(
						(item) =>
							item.snapshot.windowEnd.getTime() ===
							current.snapshot.windowStart.getTime(),
					);
					return [
						{
							key: metricKey,
							current: serializeSnapshot(current.snapshot),
							previousValue:
								previous && previous.snapshot.sampleSize > 0
									? Number(previous.snapshot.value)
									: null,
							change:
								previous &&
								current.snapshot.sampleSize > 0 &&
								previous.snapshot.sampleSize > 0
									? Math.round(
											(Number(current.snapshot.value) -
												Number(previous.snapshot.value)) *
												100,
										) / 100
									: null,
							rank: null as number | null,
						},
					];
				}),
			}))
			.filter((entry) =>
				entry.metrics.some((metric) => metric.current.sampleSize > 0),
			)
			.sort((left, right) => left.name.localeCompare(right.name));

		for (const metricKey of ACCOUNTABILITY_METRIC_KEYS) {
			const definition = ACCOUNTABILITY_METRICS[metricKey];
			const ranked = entries
				.flatMap((entry) => {
					const metric = entry.metrics.find((item) => item.key === metricKey);
					return metric?.current.eligible ? [{ entry, metric }] : [];
				})
				.sort((left, right) => {
					const difference =
						definition.direction === "lower"
							? left.metric.current.value - right.metric.current.value
							: right.metric.current.value - left.metric.current.value;
					return difference || left.entry.name.localeCompare(right.entry.name);
				});
			for (const [index, item] of ranked.entries())
				item.metric.rank = index + 1;
		}

		return {
			entries,
			metrics: ACCOUNTABILITY_METRIC_KEYS.map((key) => ({
				key,
				...ACCOUNTABILITY_METRICS[key],
			})),
			methodology: {
				metricVersion: ACCOUNTABILITY_METRIC_VERSION,
				synthetic: entries.some((entry) =>
					entry.metrics.some(
						(metric) => metric.current.sourceKind === "synthetic",
					),
				),
			},
		};
	});

export const getAuthorityAccountabilityProfile = createServerFn({
	method: "GET",
})
	.validator(profileSchema)
	.handler(async ({ data }) => {
		await setPublicAnalyticsHeaders();
		const [authority] = await db
			.select()
			.from(organization)
			.where(
				and(eq(organization.slug, data.slug), eq(organization.active, true)),
			)
			.limit(1);
		if (!authority) throw new Error("Authority not found");

		const rows = await db
			.select({
				snapshot: accountabilityMetricSnapshot,
				category: categoryNode,
			})
			.from(accountabilityMetricSnapshot)
			.leftJoin(
				categoryNode,
				eq(categoryNode.id, accountabilityMetricSnapshot.categoryNodeId),
			)
			.where(
				and(
					eq(accountabilityMetricSnapshot.organizationId, authority.id),
					eq(accountabilityMetricSnapshot.windowDays, data.windowDays),
					eq(
						accountabilityMetricSnapshot.metricVersion,
						ACCOUNTABILITY_METRIC_VERSION,
					),
				),
			)
			.orderBy(
				desc(accountabilityMetricSnapshot.windowEnd),
				asc(accountabilityMetricSnapshot.metricKey),
			);

		const aggregateByMetric = new Map<AccountabilityMetricKey, Snapshot[]>();
		const latestCategoryRows = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			const metricKey = row.snapshot.metricKey as AccountabilityMetricKey;
			if (!row.snapshot.categoryNodeId) {
				const items = aggregateByMetric.get(metricKey) ?? [];
				if (items.length < 8) items.push(row.snapshot);
				aggregateByMetric.set(metricKey, items);
				continue;
			}
			const key = `${row.snapshot.categoryNodeId}:${metricKey}`;
			if (!latestCategoryRows.has(key)) latestCategoryRows.set(key, row);
		}

		const metrics = ACCOUNTABILITY_METRIC_KEYS.flatMap((metricKey) => {
			const snapshots = aggregateByMetric.get(metricKey) ?? [];
			const current = snapshots[0];
			if (!current) return [];
			return [
				{
					key: metricKey,
					...ACCOUNTABILITY_METRICS[metricKey],
					current: serializeSnapshot(current),
					trend: [...snapshots]
						.reverse()
						.map((snapshot) => serializeSnapshot(snapshot)),
				},
			];
		});

		return {
			authority: {
				id: authority.id,
				slug: authority.slug,
				name: authority.name,
				type: authority.type,
				jurisdiction: authority.jurisdiction,
			},
			metrics,
			categories: [...latestCategoryRows.values()]
				.filter((row) => row.snapshot.sampleSize > 0)
				.map((row) => ({
					categoryId: row.snapshot.categoryNodeId,
					categoryName: row.category?.name ?? "Unknown category",
					metric: serializeSnapshot(row.snapshot),
				})),
			metricVersion: ACCOUNTABILITY_METRIC_VERSION,
		};
	});
