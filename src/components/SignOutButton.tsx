import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { text, useI18n } from "../features/i18n/i18n";
import { authClient } from "../lib/auth-client";

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
		<button
			type="button"
			onClick={() => signOutMutation.mutate()}
			disabled={signOutMutation.isPending}
			className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-bold text-[var(--ink-muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--action)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] disabled:cursor-wait disabled:opacity-60 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span]:hidden"
		>
			<LogOut size={17} aria-hidden="true" />
			<span>
				{signOutMutation.isPending
					? translate(text({ en: "Signing out…", hi: "साइन आउट हो रहा है…" }))
					: translate(text({ en: "Sign out", hi: "साइन आउट" }))}
			</span>
		</button>
	);
}
