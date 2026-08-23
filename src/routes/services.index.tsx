import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { DirectoryBrowser } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : "",
	}),
	component: ServicesDirectory,
});

function ServicesDirectory() {
	const { q } = Route.useSearch();
	const navigate = useNavigate({ from: "/services/" });
	return (
		<DirectoryBrowser
			query={q}
			onSearch={(query) => void navigate({ search: { q: query } })}
		/>
	);
}
