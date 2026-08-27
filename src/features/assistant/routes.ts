export const assistantRouteDestinations = [
	"home",
	"about",
	"public-grievances",
	"public-grievance",
	"leaderboard",
	"methodology",
	"terms",
	"privacy",
	"cookies",
	"login",
	"register",
	"dashboard",
	"services",
	"authority",
	"drafts",
	"continuation",
	"grievances",
	"grievance",
] as const;

export type AssistantRouteDestination =
	(typeof assistantRouteDestinations)[number];

export type AssistantRouteAccess = "public" | "authenticated";

export type AssistantRouteDefinition = {
	destination: AssistantRouteDestination;
	path: string;
	label: string;
	purpose: string;
	access: AssistantRouteAccess;
	requiredParameter?: "authoritySlug" | "registrationId" | "publicId";
};

export const assistantRoutes: readonly AssistantRouteDefinition[] = [
	{
		destination: "home",
		path: "/",
		label: "Home",
		purpose: "Public introduction and grievance guidance",
		access: "public",
	},
	{
		destination: "about",
		path: "/about",
		label: "About UGAAP",
		purpose: "Public information about the service",
		access: "public",
	},
	{
		destination: "public-grievances",
		path: "/public-grievances",
		label: "Public grievances",
		purpose: "Browse grievances shared publicly",
		access: "public",
	},
	{
		destination: "public-grievance",
		path: "/public-grievances/$publicId",
		label: "Public grievance details",
		purpose: "Read one publicly shared grievance",
		access: "public",
		requiredParameter: "publicId",
	},
	{
		destination: "leaderboard",
		path: "/leaderboard",
		label: "Authority performance",
		purpose: "Compare public authority performance",
		access: "public",
	},
	{
		destination: "methodology",
		path: "/methodology",
		label: "Scoring methodology",
		purpose: "Explain how public performance scores work",
		access: "public",
	},
	{
		destination: "terms",
		path: "/terms",
		label: "Terms",
		purpose: "Read the service terms",
		access: "public",
	},
	{
		destination: "privacy",
		path: "/privacy",
		label: "Privacy",
		purpose: "Read the privacy notice",
		access: "public",
	},
	{
		destination: "cookies",
		path: "/cookies",
		label: "Cookies",
		purpose: "Read the cookie notice",
		access: "public",
	},
	{
		destination: "login",
		path: "/login",
		label: "Sign in",
		purpose: "Sign in to a citizen account",
		access: "public",
	},
	{
		destination: "register",
		path: "/register",
		label: "Register",
		purpose: "Create a citizen account",
		access: "public",
	},
	{
		destination: "dashboard",
		path: "/dashboard",
		label: "Dashboard",
		purpose: "View drafts, active cases, and items needing a reply",
		access: "authenticated",
	},
	{
		destination: "services",
		path: "/services",
		label: "Start a grievance",
		purpose: "Browse authorities or search for a grievance route",
		access: "authenticated",
	},
	{
		destination: "authority",
		path: "/services/$authoritySlug",
		label: "Authority grievance catalogue",
		purpose: "Browse categories and complete an authority form",
		access: "authenticated",
		requiredParameter: "authoritySlug",
	},
	{
		destination: "drafts",
		path: "/drafts",
		label: "Saved drafts",
		purpose: "Resume the citizen's saved grievance drafts",
		access: "authenticated",
	},
	{
		destination: "continuation",
		path: "/continuation",
		label: "Continue pending work",
		purpose: "Resume a pending signed-in grievance action",
		access: "authenticated",
	},
	{
		destination: "grievances",
		path: "/grievances",
		label: "My grievances",
		purpose: "View the citizen's submitted grievances",
		access: "authenticated",
	},
	{
		destination: "grievance",
		path: "/grievances/$registrationId",
		label: "Grievance details",
		purpose: "Read the status and history of one owned grievance",
		access: "authenticated",
		requiredParameter: "registrationId",
	},
];

export function routeDefinitionForPath(pathname: string) {
	const exact = assistantRoutes.find((route) => route.path === pathname);
	if (exact) return exact;
	return assistantRoutes.find((route) => {
		if (!route.requiredParameter) return false;
		const prefix = route.path.slice(0, route.path.indexOf("$"));
		return pathname.startsWith(prefix) && pathname.length > prefix.length;
	});
}

export function assistantRouteSummary() {
	return assistantRoutes.map(({ destination, path, label, purpose, access }) => ({
		destination,
		path,
		label,
		purpose,
		access,
	}));
}
