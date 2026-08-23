import { createFileRoute } from "@tanstack/react-router";

import { AuthorityPage } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/$authoritySlug/")({
	component: AuthorityRoute,
});

function AuthorityRoute() {
	const { authoritySlug } = Route.useParams();
	return <AuthorityPage slug={authoritySlug} />;
}
