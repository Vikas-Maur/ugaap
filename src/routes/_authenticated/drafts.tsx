import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type DraftListItem, listDrafts } from "#/features/drafts/functions";
import { useI18n } from "#/features/i18n/i18n";

export const Route = createFileRoute("/_authenticated/drafts")({
	loader: () => listDrafts(),
	component: DraftsScreen,
});

function DraftsScreen() {
	const { text } = useI18n();
	const drafts = (Route.useLoaderData() ?? []) as DraftListItem[];

	return (
		<main className="page-shell">
			<p className="page-eyebrow">
				{text({ en: "Your work", hi: "आपका काम" })}
			</p>
			<h1 className="page-title">
				{text({ en: "Saved drafts", hi: "सहेजे गए मसौदे" })}
			</h1>
			<p className="page-intro">
				{text({
					en: "Pick up a grievance draft where you left it.",
					hi: "अपनी शिकायत के मसौदे को वहीं से शुरू करें जहाँ छोड़ा था।",
				})}
			</p>

			{drafts.length === 0 ? (
				<p className="mt-10 py-6 text-slate-700">
					{text({
						en: "You have no saved drafts yet.",
						hi: "आपका कोई सहेजा हुआ मसौदा अभी नहीं है।",
					})}
				</p>
			) : (
				<ul className="mt-8 grid gap-2">
					{drafts.map((item) => {
						const form = item.form;
						const authority = item.organization;
						const details = (
							<div className="min-w-0">
								<p className="text-base font-bold text-blue-950 sm:text-lg">
									{form?.title ??
										text({ en: "Unavailable form", hi: "फ़ॉर्म उपलब्ध नहीं है" })}
								</p>
								<p className="mt-1 text-sm leading-6 text-slate-600">
									{authority?.name ??
										text({
											en: "Authority unavailable",
											hi: "प्राधिकरण उपलब्ध नहीं है",
										})}
									{" · "}
									{text({ en: "Version", hi: "संस्करण" })} {form?.version ?? "?"}
								</p>
							</div>
						);
						return (
							<li key={item.draft.id}>
								{authority && form ? (
									<Link
										className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4 no-underline transition-[border-color,background-color] hover:border-[var(--blue-300)] hover:bg-[var(--blue-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
										to="/services/$authoritySlug/form/$formId"
										params={{
											authoritySlug: authority.slug,
											formId: form.formKey,
										}}
										search={{ review: false, draft: item.draft.id }}
									>
										{details}
										<span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800">
											<span className="hidden sm:inline">
												{text({ en: "Resume", hi: "जारी रखें" })}
											</span>
											<ChevronRight
												className="transition-transform group-hover:translate-x-0.5"
												size={20}
												aria-hidden="true"
											/>
										</span>
									</Link>
								) : (
									<div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4">
										{details}
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</main>
	);
}
