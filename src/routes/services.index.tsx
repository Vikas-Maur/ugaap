import { createFileRoute } from "@tanstack/react-router";

import { DirectoryBrowser } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : "",
	}),
	component: ServicesDirectory,
});

function ServicesDirectory() {
	const { q } = Route.useSearch();
	return (
		<DirectoryBrowser
			query={q}
			onQueryCommit={(query) => {
				const url = new URL(window.location.href);
				if (query) url.searchParams.set("q", query);
				else url.searchParams.delete("q");
				window.history.replaceState(
					window.history.state,
					"",
					`${url.pathname}${url.search}${url.hash}`,
				);
			}}
		/>
	);
}
