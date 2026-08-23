import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
	getCurrentSession,
	sanitizeRedirectPath,
} from "#/features/auth/functions";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async ({ location }) => {
		const session = await getCurrentSession();
		if (!session) {
			throw redirect({
				to: "/login",
				search: { redirect: sanitizeRedirectPath(location.href) },
			});
		}
		return { session };
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	return <Outlet />;
}
