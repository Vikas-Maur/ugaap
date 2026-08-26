import { createFileRoute } from "@tanstack/react-router";

import { AuthorityPage } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/$authoritySlug/")({
	validateSearch: (search: Record<string, unknown>) => ({
		...(isSafeCatalogueFormId(search.form) ? { form: search.form } : {}),
		...(isSafeCatalogueFormId(search.category)
			? { category: search.category }
			: {}),
		review: search.review === true || search.review === "true",
		...(isUuid(search.draft) ? { draft: search.draft } : {}),
	}),
	component: AuthorityRoute,
});

function AuthorityRoute() {
	const { authoritySlug } = Route.useParams();
	const { form, category, review, draft } = Route.useSearch();
	return (
		<AuthorityPage
			slug={authoritySlug}
			formId={form}
			categoryId={category}
			review={review}
			draftId={draft}
		/>
	);
}

const SAFE_CATALOGUE_FORM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/;
const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSafeCatalogueFormId(value: unknown): value is string {
	return typeof value === "string" && SAFE_CATALOGUE_FORM_ID.test(value);
}

function isUuid(value: unknown): value is string {
	return typeof value === "string" && UUID.test(value);
}
