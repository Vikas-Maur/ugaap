import { LoaderCircle, MessageSquareText, Mic } from "lucide-react";
import { lazy, Suspense } from "react";

const AssistantLauncher = lazy(() =>
	import("./AssistantLauncher").then((module) => ({
		default: module.AssistantLauncher,
	})),
);

export function AssistantEntry() {
	return (
		<Suspense
			fallback={
				<div className="assistant-dock flex min-h-[72px] items-center gap-3">
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
			<AssistantLauncher />
		</Suspense>
	);
}
