import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, notExists } from "drizzle-orm";

import { db } from "#/db/index";
import {
	formDefinition,
	grievance,
	grievanceDraft,
	organization,
} from "#/db/schema";
import { authMiddleware } from "#/server/auth/middleware";
import {
	CITIZEN_PERMISSIONS,
	requirePermissionForSession,
} from "#/server/auth/permissions";

export type DashboardGrievance = {
	registrationId: string;
	status: typeof grievance.$inferSelect.status;
	formTitle: string;
	organizationName: string;
	submittedAt: string;
	updatedAt: string;
};

export type DashboardDraft = {
	id: string;
	formKey: string;
	formTitle: string;
	formVersion: number;
	authoritySlug: string;
	authorityName: string;
	updatedAt: string;
};

export type CitizenDashboardSummary = {
	citizenName: string;
	needsReply: DashboardGrievance[];
	drafts: DashboardDraft[];
	active: DashboardGrievance[];
	recentlyResolved: DashboardGrievance[];
};

function formTitle(schema: Record<string, unknown>, fallback: string) {
	return typeof schema.title === "string" && schema.title.trim()
		? schema.title
		: fallback;
}

export const getCitizenDashboard = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }): Promise<CitizenDashboardSummary> => {
		await requirePermissionForSession(
			context.session,
			CITIZEN_PERMISSIONS.READ_OWN_GRIEVANCES,
		);

		const [grievanceRows, draftRows] = await Promise.all([
			db
				.select({ grievance, form: formDefinition, organization })
				.from(grievance)
				.innerJoin(
					formDefinition,
					eq(formDefinition.id, grievance.formDefinitionId),
				)
				.innerJoin(organization, eq(organization.id, grievance.organizationId))
				.where(eq(grievance.userId, context.session.user.id))
				.orderBy(desc(grievance.updatedAt))
				.limit(40),
			db
				.select({ draft: grievanceDraft, form: formDefinition, organization })
				.from(grievanceDraft)
				.innerJoin(
					formDefinition,
					eq(formDefinition.id, grievanceDraft.formDefinitionId),
				)
				.innerJoin(
					organization,
					eq(organization.id, formDefinition.organizationId),
				)
				.where(
					and(
						eq(grievanceDraft.userId, context.session.user.id),
						notExists(
							db
								.select({ id: grievance.id })
								.from(grievance)
								.where(eq(grievance.draftId, grievanceDraft.id)),
						),
					),
				)
				.orderBy(desc(grievanceDraft.updatedAt))
				.limit(5),
		]);

		const grievances = grievanceRows.map(
			({ grievance: item, form, organization: authority }) => ({
				registrationId: item.registrationId,
				status: item.status,
				formTitle: formTitle(form.schema, form.formKey),
				organizationName: authority.name,
				submittedAt: item.submittedAt.toISOString(),
				updatedAt: item.updatedAt.toISOString(),
			}),
		);
		const resolvedStatuses = new Set(["resolved", "appeal_resolved"]);

		return {
			citizenName:
				context.session.user.name || context.session.user.email || "Citizen",
			needsReply: grievances
				.filter((item) => item.status === "needs_information")
				.slice(0, 5),
			drafts: draftRows.map(({ draft, form, organization: authority }) => ({
				id: draft.id,
				formKey: form.formKey,
				formTitle: formTitle(form.schema, form.formKey),
				formVersion: form.version,
				authoritySlug: authority.slug,
				authorityName: authority.name,
				updatedAt: draft.updatedAt.toISOString(),
			})),
			active: grievances
				.filter(
					(item) =>
						!resolvedStatuses.has(item.status) && item.status !== "withdrawn",
				)
				.slice(0, 6),
			recentlyResolved: grievances
				.filter((item) => resolvedStatuses.has(item.status))
				.slice(0, 4),
		};
	});
