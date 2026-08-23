import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "#/lib/auth";
import { setPrivateResponseHeaders } from "#/server/http/headers";

export { sanitizeRedirectPath } from "./redirect";

const emptyInputSchema = z.object({}).strict();

/** Read Better Auth inside the request, never at module load time. */
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
	async () => {
		setPrivateResponseHeaders();
		const result = await auth.api.getSession({ headers: getRequest().headers });
		if (!result) return null;
		// Never serialize Better Auth's session token into route data.
		return {
			user: {
				id: result.user.id,
				name: result.user.name,
				email: result.user.email,
				image: result.user.image ?? null,
			},
			expiresAt: result.session.expiresAt.toISOString(),
		};
	},
);

export const getDemoLoginConfig = createServerFn({ method: "GET" })
	.validator(emptyInputSchema)
	.handler(async () => {
		setPrivateResponseHeaders();
		if (process.env.DEMO_MODE !== "true") {
			return { enabled: false as const };
		}
		return {
			enabled: true as const,
			username: "admin",
			email: "admin@ugaap.test",
			password: "admin",
		};
	});
