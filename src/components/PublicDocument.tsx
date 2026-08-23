import type { InlineCopy } from "../features/i18n/i18n";
import { useI18n } from "../features/i18n/i18n";

export type PublicDocumentSection = {
	title: InlineCopy;
	paragraphs: InlineCopy[];
};

type PublicDocumentProps = {
	eyebrow: InlineCopy;
	title: InlineCopy;
	intro: InlineCopy;
	sections: PublicDocumentSection[];
};

export function PublicDocument({
	eyebrow,
	title,
	intro,
	sections,
}: PublicDocumentProps) {
	const { text } = useI18n();

	return (
		<article className="mx-auto w-full max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20 lg:py-24 lg:pb-32">
			<header className="max-w-[920px]">
				<p className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] leading-[1.4] text-[var(--blue-700)]">
					{text(eyebrow)}
				</p>
				<h1 className="m-0 max-w-[820px] text-[clamp(2.5rem,4vw,3.5rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-[var(--blue-950)]">
					{text(title)}
				</h1>
				<p className="mt-8 max-w-[700px] text-[clamp(1.03rem,1.3vw,1.16rem)] leading-[1.75] text-[var(--ink-muted)]">
					{text(intro)}
				</p>
			</header>
			<div className="mt-16 max-w-[1040px] border-t border-[var(--line-strong)] sm:mt-20">
				{sections.map((section) => (
					<section
						className="grid grid-cols-1 gap-4 border-b border-[var(--line-strong)] py-8 sm:grid-cols-[minmax(150px,0.42fr)_minmax(0,1fr)] sm:gap-10 lg:grid-cols-[minmax(180px,0.42fr)_minmax(0,1fr)] lg:gap-16 lg:py-10"
						key={section.title.en}
					>
						<h2 className="m-0 text-base font-bold leading-7 text-[var(--ink)]">
							{text(section.title)}
						</h2>
						<div className="max-w-[680px] text-[var(--ink-muted)] leading-[1.72]">
							{section.paragraphs.map((paragraph) => (
								<p className="m-0 mb-4 last:mb-0" key={paragraph.en}>
									{text(paragraph)}
								</p>
							))}
						</div>
					</section>
				))}
			</div>
		</article>
	);
}
