import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";
import { setPrivateResponseHeaders } from "#/server/http/headers";

export type AuthSession = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>;

/** Resolve Better Auth from the request, never from client-provided user IDs. */
export async function getSessionFromRequest(
	request: Request,
): Promise<AuthSession | null> {
	return auth.api.getSession({ headers: request.headers });
}

export async function requireSession(request: Request): Promise<AuthSession> {
	const session = await getSessionFromRequest(request);
	if (!session) {
		throw new Error("Unauthorized");
	}
	setPrivateResponseHeaders();
	return session;
}

/** Attach to every private createServerFn; route guards are UX, not security. */
export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const session = await requireSession(getRequest());
		return next({ context: { session } });
	},
);
