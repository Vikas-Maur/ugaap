import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { Toaster } from "../components/ui/sonner";
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
				content: "#FFF8E7",
			},
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg",
			},
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
					<Toaster position="top-right" />
				</I18nProvider>
				<Scripts />
			</body>
		</html>
	);
}
