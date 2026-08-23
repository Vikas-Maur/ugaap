import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	type CatalogueSearchResult,
	MIN_CATALOGUE_QUERY_LENGTH,
	searchCatalogue,
} from "../features/catalogue/client";
import { text, useI18n } from "../features/i18n/i18n";

export function AssistantComposer() {
	const { text: translate } = useI18n();
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<CatalogueSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [notice, setNotice] = useState("");
	const requestSequence = useRef(0);
	const normalizedQuery = query.trim();

	useEffect(() => {
		const request = requestSequence.current + 1;
		requestSequence.current = request;
		if (normalizedQuery.length < MIN_CATALOGUE_QUERY_LENGTH) {
			setSuggestions([]);
			setSearching(false);
			setNotice("");
			return;
		}

		setSearching(true);
		setNotice("");
		searchCatalogue(normalizedQuery, { limit: 3 })
			.then((results) => {
				if (requestSequence.current === request) setSuggestions(results);
			})
			.catch(() => {
				if (requestSequence.current !== request) return;
				setSuggestions([]);
				setNotice(
					translate(
						text({
							en: "Suggestions are unavailable right now.",
							hi: "अभी सुझाव उपलब्ध नहीं हैं।",
						}),
					),
				);
			})
			.finally(() => {
				if (requestSequence.current === request) setSearching(false);
			});
	}, [normalizedQuery, translate]);

	const clear = () => {
		setQuery("");
	};
	const canSearch = normalizedQuery.length >= MIN_CATALOGUE_QUERY_LENGTH;

	return (
		<section
			className="mb-10 border-b border-blue-200 pb-10"
			aria-labelledby="assistant-title"
		>
			<div className="max-w-3xl">
				<span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
					{translate(text({ en: "Find your next step", hi: "अगला कदम खोजें" }))}
				</span>
				<h2
					id="assistant-title"
					className="mt-2 text-3xl font-semibold tracking-tight text-blue-950 md:text-4xl"
				>
					{translate(
						text({
							en: "Describe the problem. See the most relevant grievance routes instantly.",
							hi: "समस्या बताएँ। तुरंत सबसे उपयोगी शिकायत मार्ग देखें।",
						}),
					)}
				</h2>
				<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
					{translate(
						text({
							en: "Search runs on the cached grievance catalogue as you type.",
							hi: "आपके लिखते ही कैश की गई शिकायत निर्देशिका में खोज होती है।",
						}),
					)}
				</p>
			</div>

			<search className="mt-7 block max-w-4xl">
				<label className="sr-only" htmlFor="assistant-service-search">
					{translate(text({ en: "Search grievances", hi: "शिकायतें खोजें" }))}
				</label>
				<div className="flex min-h-14 items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-4 shadow-[0_8px_24px_-20px_rgba(16,24,40,0.4)] transition-[border-color,box-shadow] focus-within:border-blue-700 focus-within:ring-3 focus-within:ring-blue-100">
					<Search
						className="shrink-0 text-blue-700"
						size={20}
						aria-hidden="true"
					/>
					<input
						id="assistant-service-search"
						type="search"
						autoComplete="off"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") clear();
						}}
						className="min-w-0 flex-1 bg-transparent text-base text-blue-950 outline-none placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
						placeholder={translate(
							text({
								en: "Try “My pension payment is delayed”",
								hi: "“मेरी पेंशन का भुगतान देर से हुआ है” लिखें",
							}),
						)}
					/>
					{searching ? (
						<LoaderCircle
							className="animate-spin text-blue-700"
							size={19}
							aria-hidden="true"
						/>
					) : null}
					{query ? (
						<button
							className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
							type="button"
							onClick={clear}
							aria-label={translate(
								text({ en: "Clear search", hi: "खोज साफ़ करें" }),
							)}
						>
							<X size={18} aria-hidden="true" />
						</button>
					) : null}
				</div>

				<output className="sr-only" aria-live="polite">
					{searching
						? translate(
								text({
									en: "Searching the catalogue.",
									hi: "निर्देशिका में खोज जारी है।",
								}),
							)
						: canSearch
							? translate(
									text({
										en: `${suggestions.length} suggestions found.`,
										hi: `${suggestions.length} सुझाव मिले।`,
									}),
								)
							: ""}
				</output>
				{query.trim().length === 1 ? (
					<p className="mt-2 text-sm text-slate-500">
						{translate(
							text({
								en: "Type one more character to see suggestions.",
								hi: "सुझाव देखने के लिए एक और अक्षर लिखें।",
							}),
						)}
					</p>
				) : null}

				{canSearch ? (
					<div className="mt-3 border-y border-blue-200" aria-busy={searching}>
						{suggestions.map((result) => (
							<Link
								key={result.id}
								to="/services/$authoritySlug/form/$formId"
								params={{
									authoritySlug: result.authoritySlug,
									formId: result.id,
								}}
								search={{ review: false, draft: undefined }}
								className="group grid gap-2 border-b border-blue-200 px-1 py-4 last:border-b-0 transition-colors hover:bg-blue-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
							>
								<div className="min-w-0">
									<p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
										{result.authorityName}
									</p>
									<p className="mt-1 font-semibold text-blue-950">
										{result.title}
									</p>
								</div>
								<ArrowUpRight
									className="text-blue-700 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
									size={18}
									aria-hidden="true"
								/>
							</Link>
						))}
						{!searching && suggestions.length === 0 ? (
							<p className="py-4 text-sm text-slate-600">
								{translate(
									text({
										en: "No close matches yet. Try fewer or simpler words.",
										hi: "अभी कोई नज़दीकी परिणाम नहीं मिला। कम या आसान शब्द लिखें।",
									}),
								)}
							</p>
						) : null}
					</div>
				) : null}

				{canSearch ? (
					<Link
						to="/services"
						search={{ q: normalizedQuery }}
						className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					>
						{translate(
							text({ en: "View all matching routes", hi: "सभी मिलते मार्ग देखें" }),
						)}
						<ArrowUpRight size={16} aria-hidden="true" />
					</Link>
				) : null}
				{notice ? (
					<output className="mt-3 block text-sm font-medium text-red-700">
						{notice}
					</output>
				) : null}
			</search>
		</section>
	);
}
