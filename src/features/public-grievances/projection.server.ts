import { and, eq, isNull } from "drizzle-orm";
import type { db } from "#/db/index";
import { publicGrievance, publicGrievanceEvent } from "#/db/schema";

type GrievanceStatus = typeof publicGrievance.$inferSelect.status;
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const publicStatusLabels: Record<GrievanceStatus, string> = {
	draft: "Grievance prepared",
	submitted: "Grievance submitted",
	acknowledged: "Grievance acknowledged",
	routed: "Sent to the responsible organization",
	in_review: "Under review",
	needs_information: "More information requested",
	action_taken: "Organization reports action taken",
	resolved: "Grievance resolved",
	appealed: "Resolution appealed",
	appeal_resolved: "Appeal decided",
	withdrawn: "Official grievance withdrawn",
};

export function publicStatusLabel(status: GrievanceStatus) {
	return publicStatusLabels[status];
}

export async function projectPublicStatusEvent(
	tx: DatabaseTransaction,
	input: {
		grievanceId: string;
		sourceEventId: string;
		status: GrievanceStatus;
		occurredAt: Date;
	},
) {
	const [publicCopy] = await tx
		.select({ id: publicGrievance.id })
		.from(publicGrievance)
		.where(
			and(
				eq(publicGrievance.grievanceId, input.grievanceId),
				isNull(publicGrievance.withdrawnAt),
			),
		)
		.limit(1);
	if (!publicCopy) return;

	await tx
		.update(publicGrievance)
		.set({ status: input.status, updatedAt: input.occurredAt })
		.where(eq(publicGrievance.id, publicCopy.id));
	await tx
		.insert(publicGrievanceEvent)
		.values({
			publicGrievanceId: publicCopy.id,
			sourceEventId: input.sourceEventId,
			status: input.status,
			label: publicStatusLabel(input.status),
			occurredAt: input.occurredAt,
		})
		.onConflictDoNothing({ target: publicGrievanceEvent.sourceEventId });
}
