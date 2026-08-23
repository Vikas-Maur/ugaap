import { createFileRoute } from "@tanstack/react-router";

import { FormPage } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/$authoritySlug/form/$formId")({
	validateSearch: (search: Record<string, unknown>) => ({
		review: search.review === true || search.review === "true",
		draft:
			typeof search.draft === "string" &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
				search.draft,
			)
				? search.draft
				: undefined,
	}),
	component: ServiceFormRoute,
});

function ServiceFormRoute() {
	const { authoritySlug, formId } = Route.useParams();
	const { review, draft } = Route.useSearch();
	return (
		<FormPage
			slug={authoritySlug}
			formId={formId}
			review={review}
			draftId={draft}
		/>
	);
}
