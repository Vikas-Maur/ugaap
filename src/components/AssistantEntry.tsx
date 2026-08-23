import { LoaderCircle, MessageSquareText, Mic } from "lucide-react";
import { lazy, Suspense } from "react";

const AssistantLauncher = lazy(() =>
	import("./AssistantLauncher").then((module) => ({
		default: module.AssistantLauncher,
	})),
);

export function AssistantEntry({ home = false }: { home?: boolean }) {
	return (
		<Suspense
			fallback={
				<div
					className={`assistant-dock fixed inset-x-3 z-40 mx-auto flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-3 pb-4 pt-5 shadow-[0_18px_55px_rgba(16,24,40,0.14)] transition-[bottom,max-width,min-height,transform] duration-500 sm:inset-x-6 sm:px-4 ${home ? "bottom-[clamp(2.5rem,10vh,7rem)] min-h-[172px] max-w-[920px]" : "bottom-3 min-h-[124px] max-w-[760px] sm:bottom-5"}`}
				>
					<div className="grid size-13 shrink-0 place-items-center rounded-full bg-[var(--blue-800)] text-white">
						<Mic size={21} aria-hidden="true" />
					</div>
					<div className="min-h-[88px] min-w-0 flex-1" />
					<div className="grid size-13 shrink-0 place-items-center rounded-full bg-[var(--blue-800)] text-white">
						<LoaderCircle
							className="animate-spin"
							size={19}
							aria-hidden="true"
						/>
					</div>
					<div className="grid size-13 shrink-0 place-items-center rounded-full bg-[var(--blue-50)] text-[var(--blue-800)]">
						<MessageSquareText size={19} aria-hidden="true" />
					</div>
				</div>
			}
		>
			<AssistantLauncher home={home} />
		</Suspense>
	);
}
