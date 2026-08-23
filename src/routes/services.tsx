import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
	getCurrentSession,
	sanitizeRedirectPath,
} from "#/features/auth/functions";

export const Route = createFileRoute("/services")({
	beforeLoad: async ({ location }) => {
		if (!(await getCurrentSession())) {
			throw redirect({
				to: "/login",
				search: { redirect: sanitizeRedirectPath(location.href) },
			});
		}
	},
	component: ServicesLayout,
});

function ServicesLayout() {
	return <Outlet />;
}
