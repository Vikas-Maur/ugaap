import type { ReactNode } from "react";

type AuthPageLayoutProps = {
	titleId: string;
	eyebrow: ReactNode;
	title: ReactNode;
	description: ReactNode;
	children: ReactNode;
	footer: ReactNode;
};

export function AuthPageLayout({
	titleId,
	eyebrow,
	title,
	description,
	children,
	footer,
}: AuthPageLayoutProps) {
	return (
		<div className="min-h-[calc(100svh-64px)] bg-[var(--paper)]">
			<div className="mx-auto w-full max-w-[540px] px-4 pb-44 pt-7 sm:px-6 sm:pt-10">
				<header className="mb-7">
					<p className="m-0 text-sm font-semibold text-[var(--blue-700)]">
						{eyebrow}
					</p>
					<h1
						id={titleId}
						className="mb-0 mt-3 text-[clamp(2.35rem,7vw,3.35rem)] font-semibold leading-[1] tracking-[-0.055em] text-[var(--blue-950)]"
					>
						{title}
					</h1>
					<p className="mb-0 mt-4 max-w-[500px] text-base leading-7 text-[var(--ink-muted)]">
						{description}
					</p>
				</header>

				<section aria-labelledby={titleId}>{children}</section>

				<div className="mt-6 border-t border-[var(--line)] pt-5 text-sm text-[var(--ink-muted)]">
					{footer}
				</div>
			</div>
		</div>
	);
}
