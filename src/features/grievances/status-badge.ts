const statusBadgeClasses: Record<string, string> = {
	submitted: "border-blue-300 bg-blue-50 text-blue-900",
	acknowledged: "border-sky-300 bg-sky-50 text-sky-950",
	routed: "border-indigo-300 bg-indigo-50 text-indigo-950",
	in_review:
		"border-[var(--blue-300)] bg-[var(--blue-50)] text-[var(--blue-900)]",
	needs_information: "border-amber-300 bg-amber-50 text-amber-950",
	action_taken: "border-indigo-300 bg-indigo-50 text-indigo-950",
	resolved: "border-emerald-300 bg-emerald-50 text-emerald-950",
	appealed: "border-violet-300 bg-violet-50 text-violet-950",
	appeal_resolved: "border-emerald-300 bg-emerald-50 text-emerald-950",
	withdrawn: "border-slate-300 bg-slate-100 text-slate-700",
};

const defaultStatusBadgeClass = "border-slate-300 bg-slate-100 text-slate-700";

export function statusBadgeClass(status: string) {
	return statusBadgeClasses[status] ?? defaultStatusBadgeClass;
}
