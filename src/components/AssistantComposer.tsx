import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Search } from "lucide-react";
import { type FormEvent, useState } from "react";

import { text, useI18n } from "../features/i18n/i18n";

export function AssistantComposer() {
	const { text: translate } = useI18n();
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [notice, setNotice] = useState("");

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const value = query.trim();

		if (!value) {
			setNotice(
				translate(
					text({
						en: "Describe the grievance to search.",
						hi: "खोजने के लिए शिकायत के बारे में लिखें।",
					}),
				),
			);
			return;
		}

		void navigate({ to: "/services", search: { q: value } });
	}

	return (
		<section
			className="mb-10 grid gap-8 border-b-2 border-blue-800 pb-8 lg:grid-cols-[minmax(0,.8fr)_minmax(22rem,1.2fr)] lg:items-end"
			aria-labelledby="assistant-title"
		>
			<div>
				<span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
					{translate(text({ en: "Find your next step", hi: "अगला कदम खोजें" }))}
				</span>
				<h2
					id="assistant-title"
					className="mt-2 text-2xl font-bold tracking-tight text-blue-950 md:text-3xl"
				>
					{translate(
						text({
							en: "Find the right authority for a grievance.",
							hi: "अपनी शिकायत के लिए सही प्राधिकरण खोजें।",
						}),
					)}
				</h2>
				<p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
					{translate(
						text({
							en: "Describe what happened to search the grievance catalogue.",
							hi: "क्या हुआ, यह लिखकर शिकायत निर्देशिका में खोजें।",
						}),
					)}
				</p>
			</div>
			<search>
				<form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
					<label className="sr-only" htmlFor="service-search">
						{translate(text({ en: "Search grievances", hi: "शिकायतें खोजें" }))}
					</label>
					<div className="flex min-h-12 flex-1 items-center gap-3 border border-blue-300 bg-white px-4 shadow-sm focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-200">
						<Search
							className="shrink-0 text-blue-800"
							size={20}
							aria-hidden="true"
						/>
						<input
							id="service-search"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setNotice("");
							}}
							className="min-w-0 flex-1 bg-transparent text-base text-blue-950 outline-none placeholder:text-slate-500"
							placeholder={translate(
								text({
									en: "Try “My pension payment is delayed”",
									hi: "“मेरी पेंशन का भुगतान देर से हुआ है” लिखें",
								}),
							)}
						/>
					</div>
					<button
						className="inline-flex min-h-12 items-center justify-center gap-2 border border-blue-900 bg-blue-900 px-6 font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						type="submit"
					>
						<span>{translate(text({ en: "Search", hi: "खोजें" }))}</span>
						<ArrowUpRight size={17} aria-hidden="true" />
					</button>
				</form>
				{notice ? (
					<output className="mt-3 block text-sm font-medium text-red-700">
						{notice}
					</output>
				) : null}
			</search>
		</section>
	);
}
