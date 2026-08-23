import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { AssistantProvider } from "../features/assistant/context";
import { I18nProvider } from "../features/i18n/i18n";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "UGAAP | Grievance access",
			},
			{
				name: "theme-color",
				content: "#f7f9fc",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<I18nProvider>
					<AssistantProvider>
						<AppShell>{children}</AppShell>
					</AssistantProvider>
				</I18nProvider>
				<Scripts />
			</body>
		</html>
	);
}
