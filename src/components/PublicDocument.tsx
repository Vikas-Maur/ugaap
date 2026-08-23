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
		<article className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-14 px-4 py-[72px] sm:px-6 sm:py-[88px] lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] lg:gap-[clamp(56px,9vw,140px)] lg:py-[100px] lg:pb-[130px]">
			<header>
				<p className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] leading-[1.4] text-[var(--blue-700)]">
					{text(eyebrow)}
				</p>
				<h1 className="m-0 text-[clamp(2.7rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.06em] text-[var(--blue-950)]">
					{text(title)}
				</h1>
				<p className="mt-7 max-w-[590px] text-[1.02rem] leading-[1.72] text-[var(--ink-muted)]">
					{text(intro)}
				</p>
			</header>
			<div className="border-t border-[var(--line-strong)]">
				{sections.map((section) => (
					<section
						className="grid grid-cols-1 gap-3 border-b border-[var(--line-strong)] py-7 pb-9 sm:grid-cols-[minmax(150px,0.5fr)_1fr] sm:gap-8"
						key={section.title.en}
					>
						<h2 className="m-0 text-base font-bold text-[var(--ink)]">
							{text(section.title)}
						</h2>
						<div className="text-[var(--ink-muted)] leading-[1.72]">
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
