import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/accountability")({
	component: AccountabilityLayout,
});

function AccountabilityLayout() {
	return <Outlet />;
}
