import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DirectoryBrowser } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : "",
	}),
	component: ServicesDirectory,
});

function ServicesDirectory() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<DirectoryBrowser
			query={search.q}
			onSearchCommit={(next) => {
				void navigate({
					search: { q: next.q ?? "" },
					replace: true,
					resetScroll: false,
				});
			}}
		/>
	);
}
