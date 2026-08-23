import { createMiddleware } from "@tanstack/react-start";
import type { auth } from "#/lib/auth";

export type AuthSession = NonNullable<
	Awaited<ReturnType<typeof auth.api.getSession>>
>;

/** Resolve Better Auth from the request, never from client-provided user IDs. */
export async function getSessionFromRequest(
	request: Request,
): Promise<AuthSession | null> {
	const { auth } = await import("#/lib/auth");
	return auth.api.getSession({ headers: request.headers });
}

export async function requireSession(request: Request): Promise<AuthSession> {
	const session = await getSessionFromRequest(request);
	if (!session) {
		throw new Error("Unauthorized");
	}
	const { setPrivateResponseHeaders } = await import("#/server/http/headers");
	setPrivateResponseHeaders();
	return session;
}

/** Attach to every private createServerFn; route guards are UX, not security. */
export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const [{ getRequest }, { setPrivateResponseHeaders }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("#/server/http/headers"),
		]);
		setPrivateResponseHeaders();
		const request = getRequest();
		const origin = request.headers.get("origin");
		if (origin && new URL(origin).origin !== new URL(request.url).origin) {
			throw new Error("Origin check failed");
		}
		const session = await requireSession(request);
		return next({ context: { session } });
	},
);
