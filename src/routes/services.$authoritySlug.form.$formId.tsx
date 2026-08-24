import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/services/$authoritySlug/form/$formId")({
	validateSearch: (search: Record<string, unknown>) => ({
		review: search.review === true || search.review === "true",
		draft: isUuid(search.draft) ? search.draft : undefined,
	}),
	component: ServiceFormRoute,
});

function ServiceFormRoute() {
	const { authoritySlug, formId } = Route.useParams();
	const { review, draft } = Route.useSearch();
	return (
		<Navigate
			to="/services/$authoritySlug"
			params={{ authoritySlug }}
			search={{
				form: isSafeCatalogueFormId(formId) ? formId : undefined,
				review,
				draft,
			}}
			replace
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
