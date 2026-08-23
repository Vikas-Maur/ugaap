import { and, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { permission, role, rolePermission, userRole } from "#/db/schema";
import {
	type AuthSession,
	getSessionFromRequest,
} from "#/server/auth/middleware";
import { setPrivateResponseHeaders } from "#/server/http/headers";

/** The only permissions used by the active citizen UI in Phase 0. */
export const CITIZEN_PERMISSIONS = {
	CREATE_GRIEVANCE: "grievance:create",
	READ_OWN_GRIEVANCES: "grievance:read:self",
	REPLY_OWN_GRIEVANCE: "grievance:reply:self",
	CREATE_APPEAL: "appeal:create",
	MANAGE_OWN_PUBLICATION: "publication:manage:self",
	READ_PUBLIC_ANALYTICS: "analytics:read:public",
} as const;

export type CitizenPermission =
	(typeof CITIZEN_PERMISSIONS)[keyof typeof CITIZEN_PERMISSIONS];

/** Query active RBAC rows; do not infer authorization from UI state. */
export async function hasPermission(
	userId: string,
	permissionKey: string,
): Promise<boolean> {
	const rows = await db
		.select({ permissionId: permission.id })
		.from(userRole)
		.innerJoin(role, eq(role.id, userRole.roleId))
		.innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
		.innerJoin(permission, eq(permission.id, rolePermission.permissionId))
		.where(
			and(
				eq(userRole.userId, userId),
				eq(role.active, true),
				eq(permission.active, true),
				eq(permission.key, permissionKey),
			),
		)
		.limit(1);

	return rows.length > 0;
}

export async function requirePermissionForSession(
	session: AuthSession,
	permissionKey: CitizenPermission | string,
): Promise<AuthSession> {
	if (!(await hasPermission(session.user.id, permissionKey))) {
		throw new Error("Forbidden");
	}
	setPrivateResponseHeaders();
	return session;
}

export async function requirePermission(
	request: Request,
	permissionKey: CitizenPermission | string,
): Promise<AuthSession> {
	const session = await getSessionFromRequest(request);
	if (!session) {
		throw new Error("Unauthorized");
	}
	return requirePermissionForSession(session, permissionKey);
}
