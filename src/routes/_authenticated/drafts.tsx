import { createFileRoute, Link } from "@tanstack/react-router";
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
		<main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
			<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
				{text({ en: "Your work", hi: "आपका काम" })}
			</p>
			<h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
				{text({ en: "Saved drafts", hi: "सहेजे गए मसौदे" })}
			</h1>
			<p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
				{text({
					en: "Pick up a grievance draft where you left it.",
					hi: "अपनी शिकायत के मसौदे को वहीं से शुरू करें जहाँ छोड़ा था।",
				})}
			</p>

			{drafts.length === 0 ? (
				<p className="mt-10 border-y border-blue-200 py-6 text-slate-700">
					{text({
						en: "You have no saved drafts yet.",
						hi: "आपका कोई सहेजा हुआ मसौदा अभी नहीं है।",
					})}
				</p>
			) : (
				<ul className="mt-10 divide-y-2 divide-blue-200 border-y-2 border-blue-200">
					{drafts.map((item) => {
						const form = item.form;
						const authority = item.organization;
						return (
							<li
								key={item.draft.id}
								className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<p className="text-lg font-bold text-blue-950">
										{form?.formKey ??
											text({ en: "Unavailable form", hi: "फ़ॉर्म उपलब्ध नहीं है" })}
									</p>
									<p className="mt-1 text-sm leading-6 text-slate-600">
										{authority?.name ??
											text({
												en: "Authority unavailable",
												hi: "प्राधिकरण उपलब्ध नहीं है",
											})}
										{" · "}
										{text({ en: "Version", hi: "संस्करण" })}{" "}
										{form?.version ?? "?"}
									</p>
								</div>
								{authority && form ? (
									<Link
										className="inline-flex min-h-11 shrink-0 items-center justify-center border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
										to="/services/$authoritySlug/form/$formId"
										params={{ authoritySlug: authority.slug, formId: form.id }}
										search={{ review: false, draft: item.draft.id }}
									>
										{text({ en: "Resume draft", hi: "मसौदा फिर शुरू करें" })}
									</Link>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</main>
	);
}
