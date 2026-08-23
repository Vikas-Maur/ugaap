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

export const isDemoModeEnabled = createServerFn({ method: "GET" })
	.validator(emptyInputSchema)
	.handler(async () => ({ enabled: process.env.DEMO_MODE === "true" }));

/** Create a fresh account and session for each demo click. */
export const createDemoSession = createServerFn({ method: "POST" })
	.validator(emptyInputSchema)
	.handler(async () => {
		if (process.env.DEMO_MODE !== "true") {
			throw new Error("Demo access is unavailable");
		}

		const unique = globalThis.crypto.randomUUID();
		const email = `demo-${unique}@demo.local`;
		const password = `${globalThis.crypto.randomUUID()}!A9`;
		const result = await auth.api.signUpEmail({
			body: {
				name: "UGAAP demo citizen",
				email,
				password,
			},
			headers: getRequest().headers,
		});

		setPrivateResponseHeaders();
		return { user: result.user };
	});
