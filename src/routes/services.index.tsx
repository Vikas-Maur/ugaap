import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DirectoryBrowser } from "#/features/catalogue/ui/catalogue";

export const Route = createFileRoute("/services/")({
	validateSearch: (search: Record<string, unknown>) =>
		typeof search.q === "string" && search.q ? { q: search.q } : {},
	component: ServicesDirectory,
});

function ServicesDirectory() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<DirectoryBrowser
			query={search.q ?? ""}
			onSearchCommit={(next) => {
				void navigate({
					search: next.q ? { q: next.q } : {},
					replace: true,
					resetScroll: false,
				});
			}}
		/>
	);
}
