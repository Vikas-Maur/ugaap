import { LoaderCircle, MessageSquareText, Mic } from "lucide-react";
import { lazy, Suspense } from "react";

const AssistantLauncher = lazy(() =>
	import("./AssistantLauncher").then((module) => ({
		default: module.AssistantLauncher,
	})),
);

export function AssistantEntry({
	home = false,
	workspace = false,
}: {
	home?: boolean;
	workspace?: boolean;
}) {
	return (
		<Suspense
			fallback={
				<div
					className={`assistant-dock fixed inset-x-3 z-40 mx-auto flex min-h-[72px] max-w-[900px] items-center gap-3 rounded-xl border-2 border-[var(--action)] bg-[var(--paper)] px-3 py-2 shadow-[0_14px_45px_rgba(42,24,15,0.18)] sm:inset-x-6 sm:px-4 ${workspace ? "bottom-[4.65rem] md:bottom-4" : "bottom-4"}`}
				>
					<div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--highlight)] text-[var(--ink)]">
						<Mic size={21} aria-hidden="true" />
					</div>
					<div className="min-h-11 min-w-0 flex-1" />
					<div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--action)] text-white">
						<LoaderCircle
							className="animate-spin"
							size={19}
							aria-hidden="true"
						/>
					</div>
					<div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--blue-50)] text-[var(--action)]">
						<MessageSquareText size={19} aria-hidden="true" />
					</div>
				</div>
			}
		>
			<AssistantLauncher home={home} workspace={workspace} />
		</Suspense>
	);
}
