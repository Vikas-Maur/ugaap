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

const metricSchema = z.enum(ACCOUNTABILITY_METRIC_KEYS);
const windowDaysSchema = z.union([
	z.literal(30),
	z.literal(90),
	z.literal(365),
]);
const overviewSchema = z
	.object({
		metric: metricSchema,
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
					eq(accountabilityMetricSnapshot.metricKey, data.metric),
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
				desc(accountabilityMetricSnapshot.windowEnd),
			);

		const byOrganization = new Map<string, Array<(typeof rows)[number]>>();
		for (const row of rows) {
			if (rankingGroup(row.organization) !== data.group) continue;
			const items = byOrganization.get(row.organization.id) ?? [];
			items.push(row);
			byOrganization.set(row.organization.id, items);
		}

		const definition = ACCOUNTABILITY_METRICS[data.metric];
		const entries = [...byOrganization.values()].flatMap((items) => {
			const current = items[0];
			if (!current) return [];
			const previous = items.find(
				(item) =>
					item.snapshot.windowEnd.getTime() ===
					current.snapshot.windowStart.getTime(),
			);
			return [
				{
					id: current.organization.id,
					slug: current.organization.slug,
					name: current.organization.name,
					type: current.organization.type,
					jurisdiction: current.organization.jurisdiction,
					current: serializeSnapshot(current.snapshot),
					previousValue: previous ? Number(previous.snapshot.value) : null,
					change: previous
						? Math.round(
								(Number(current.snapshot.value) -
									Number(previous.snapshot.value)) *
									100,
							) / 100
						: null,
				},
			];
		});

		const eligible = entries
			.filter((entry) => entry.current.eligible)
			.sort((left, right) => {
				const difference =
					definition.direction === "lower"
						? left.current.value - right.current.value
						: right.current.value - left.current.value;
				return difference || left.name.localeCompare(right.name);
			});
		const rankById = new Map(
			eligible.map((entry, index) => [entry.id, index + 1]),
		);
		const ranked = entries
			.sort((left, right) => {
				const leftRank = rankById.get(left.id);
				const rightRank = rankById.get(right.id);
				if (leftRank && rightRank) return leftRank - rightRank;
				if (leftRank) return -1;
				if (rightRank) return 1;
				return left.name.localeCompare(right.name);
			})
			.map((entry) => ({ ...entry, rank: rankById.get(entry.id) ?? null }));

		return {
			entries: ranked,
			metric: { key: data.metric, ...definition },
			metrics: ACCOUNTABILITY_METRIC_KEYS.map((key) => ({
				key,
				...ACCOUNTABILITY_METRICS[key],
			})),
			methodology: {
				metricVersion: ACCOUNTABILITY_METRIC_VERSION,
				minimumSample: definition.minimumSample,
				synthetic: ranked.some(
					(entry) => entry.current.sourceKind === "synthetic",
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
