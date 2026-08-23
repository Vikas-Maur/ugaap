import type {
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
} from "react";

import { type InlineCopy, useI18n } from "../features/i18n/i18n";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "quiet" | "danger";
	icon?: ReactNode;
};

const buttonVariants = {
	primary:
		"border-blue-900 bg-blue-900 text-white hover:border-blue-950 hover:bg-blue-950",
	secondary:
		"border-blue-300 bg-transparent text-blue-950 hover:border-blue-700 hover:bg-blue-50",
	quiet:
		"border-slate-400 bg-transparent text-blue-900 hover:border-blue-700 hover:bg-blue-50",
	danger: "border-red-800 bg-red-800 text-white hover:bg-red-950",
} as const;

export function Button({
	className = "",
	variant = "primary",
	icon,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={`inline-flex min-h-11 items-center justify-center gap-2 border px-4 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant]} ${className}`}
			{...props}
		>
			{icon ? (
				<span className="inline-flex" aria-hidden="true">
					{icon}
				</span>
			) : null}
			<span>{children}</span>
		</button>
	);
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
	label?: InlineCopy;
	hint?: InlineCopy;
};

export function TextInput({ label, hint, id, ...props }: TextInputProps) {
	const { text } = useI18n();
	const inputId = id ?? props.name;

	return (
		<label className="grid gap-1.5" htmlFor={inputId}>
			{label ? <span className="text-sm font-bold">{text(label)}</span> : null}
			<input
				className="min-h-11 w-full border border-slate-400 bg-[var(--paper)] px-3 text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
				id={inputId}
				{...props}
			/>
			{hint ? (
				<span className="text-xs text-slate-600">{text(hint)}</span>
			) : null}
		</label>
	);
}

export function LoadingState({ label }: { label: InlineCopy }) {
	const { text } = useI18n();
	return (
		<output className="flex min-h-20 items-center gap-3 border-y border-slate-400 py-4 text-slate-600">
			<span
				className="size-[18px] animate-spin rounded-full border-2 border-slate-300 border-t-blue-700"
				aria-hidden="true"
			/>
			<span>{text(label)}</span>
		</output>
	);
}

export function EmptyState({
	title,
	body,
}: {
	title: InlineCopy;
	body: InlineCopy;
}) {
	const { text } = useI18n();
	return (
		<div className="border-y border-slate-400 py-5 text-slate-600">
			<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
				{text({ en: "Nothing here yet", hi: "अभी कुछ नहीं है" })}
			</span>
			<h3 className="m-0 text-base font-bold text-slate-950">{text(title)}</h3>
			<p className="mt-1 mb-0">{text(body)}</p>
		</div>
	);
}

export function ErrorState({
	title,
	body,
}: {
	title: InlineCopy;
	body: InlineCopy;
}) {
	const { text } = useI18n();
	return (
		<div className="border-y border-red-400 py-5 text-red-800" role="alert">
			<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.1em]">
				{text({ en: "Needs attention", hi: "ध्यान दें" })}
			</span>
			<h3 className="m-0 text-base font-bold">{text(title)}</h3>
			<p className="mt-1 mb-0">{text(body)}</p>
		</div>
	);
}

export function ReviewStatus({
	status,
}: {
	status: "draft" | "review" | "complete";
}) {
	const { text } = useI18n();
	const labels = {
		draft: { en: "Draft", hi: "मसौदा" },
		review: { en: "In review", hi: "जाँच में" },
		complete: { en: "Complete", hi: "पूरा" },
	} as const;

	return (
		<span className="inline-flex min-h-6 items-center border border-slate-400 px-2 text-xs font-extrabold text-slate-600">
			{text(labels[status])}
		</span>
	);
}
