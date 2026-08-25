import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { text, useI18n } from "../features/i18n/i18n";
import { authClient } from "../lib/auth-client";
import { SidebarMenuButton } from "./ui/sidebar";

function formatSignOutError(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export function SignOutButton() {
	const { text: translate } = useI18n();
	const navigate = useNavigate();
	const signOutMutation = useMutation({
		mutationFn: async () => {
			const result = await authClient.signOut();
			if (result.error) {
				const status = result.error.status
					? ` (${result.error.status} ${result.error.statusText})`
					: "";
				throw new Error(
					`Sign out failed: ${result.error.message || "Unknown error"}${status}`,
				);
			}
		},
		onError: (error) => {
			toast.error(
				formatSignOutError(
					error,
					translate(
						text({
							en: "Sign out failed with an unknown error.",
							hi: "साइन आउट में एक अज्ञात त्रुटि हुई।",
						}),
					),
				),
			);
		},
		onSuccess: () => {
			void navigate({ to: "/", replace: true });
		},
	});

	return (
		<SidebarMenuButton
			onClick={() => signOutMutation.mutate()}
			disabled={signOutMutation.isPending}
			tooltip={translate(text({ en: "Sign out", hi: "साइन आउट" }))}
			className="h-10 rounded-lg px-3"
		>
			<LogOut aria-hidden="true" />
			<span>
				{signOutMutation.isPending
					? translate(text({ en: "Signing out…", hi: "साइन आउट हो रहा है…" }))
					: translate(text({ en: "Sign out", hi: "साइन आउट" }))}
			</span>
		</SidebarMenuButton>
	);
}
