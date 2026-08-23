import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LoaderCircle, Search, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAssistantContext } from "#/features/assistant/context";
import { useI18n } from "#/features/i18n/i18n";

import {
	type CatalogueAuthority,
	type CatalogueDirectory,
	type CatalogueSearchResult,
	findForm,
	loadAuthorityChunk,
	loadCatalogueDirectory,
	MIN_CATALOGUE_QUERY_LENGTH,
	searchCatalogue,
} from "../client";
import {
	type FormErrors,
	type FormValues,
	fieldHasValue,
	useCatalogueFormState,
} from "../form-state";
import type {
	AuthorityChunk,
	CatalogueCategory,
	CatalogueField,
	CatalogueForm,
} from "../schema";

const copy = (en: string, hi: string) => ({ en, hi });

export function DirectoryBrowser({
	query,
	onQueryCommit,
}: {
	query: string;
	onQueryCommit: (query: string) => void;
}) {
	const { text } = useI18n();
	const [directory, setDirectory] = useState<CatalogueDirectory | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [inputQuery, setInputQuery] = useState(query);
	const [searchResults, setSearchResults] = useState<CatalogueSearchResult[]>(
		[],
	);
	const [searching, setSearching] = useState(false);
	const searchRequest = useRef(0);
	const normalizedQuery = inputQuery.trim();

	useEffect(() => {
		setInputQuery(query);
	}, [query]);

	useEffect(() => {
		let active = true;
		loadCatalogueDirectory()
			.then((value) => active && setDirectory(value))
			.catch(
				() =>
					active &&
					setError(
						text(
							copy(
								"We could not load the grievance directory.",
								"शिकायत निर्देशिका लोड नहीं हो सकी।",
							),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [text]);

	useEffect(() => {
		const request = searchRequest.current + 1;
		searchRequest.current = request;
		if (normalizedQuery.length < MIN_CATALOGUE_QUERY_LENGTH) {
			setSearchResults([]);
			setSearching(false);
			setError(null);
			return;
		}
		setSearching(true);
		setError(null);
		searchCatalogue(normalizedQuery)
			.then((results) => {
				if (searchRequest.current === request) setSearchResults(results);
			})
			.catch(() => {
				if (searchRequest.current !== request) return;
				setError(
					text(
						copy("Search is unavailable right now.", "अभी खोज उपलब्ध नहीं है।"),
					),
				);
			})
			.finally(() => {
				if (searchRequest.current === request) setSearching(false);
			});
	}, [normalizedQuery, text]);

	const clearSearch = () => {
		setInputQuery("");
		onQueryCommit("");
	};
	const hasSearchQuery = normalizedQuery.length >= MIN_CATALOGUE_QUERY_LENGTH;
	const needsMoreCharacters =
		inputQuery.trim().length > 0 &&
		inputQuery.trim().length < MIN_CATALOGUE_QUERY_LENGTH;

	return (
		<div className="w-full py-2 md:py-4">
			<h1 className="sr-only">
				{text(copy("Find a grievance category", "शिकायत श्रेणी खोजें"))}
			</h1>
			<search className="mb-8 border-b border-blue-200 pb-8">
				<label className="sr-only" htmlFor="service-search">
					{text(copy("Search grievance categories", "शिकायत श्रेणियाँ खोजें"))}
				</label>
				<div className="flex min-h-14 items-center gap-3 rounded-xl border border-blue-300 bg-white px-4 shadow-[0_10px_35px_-24px_rgba(15,59,138,0.7)] transition-[border-color,box-shadow] focus-within:border-blue-700 focus-within:ring-4 focus-within:ring-blue-100">
					<Search
						className="shrink-0 text-blue-700"
						size={20}
						aria-hidden="true"
					/>
					<input
						id="service-search"
						name="service-search"
						type="search"
						autoComplete="off"
						value={inputQuery}
						onChange={(event) => setInputQuery(event.target.value)}
						onBlur={() => onQueryCommit(normalizedQuery)}
						onKeyDown={(event) => {
							if (event.key === "Escape") clearSearch();
						}}
						className="min-w-0 flex-1 bg-transparent text-base text-blue-950 outline-none placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
						placeholder={text(
							copy(
								"Try: passport delay, pension, broadband",
								"जैसे: पासपोर्ट में देरी, पेंशन, ब्रॉडबैंड",
							),
						)}
					/>
					{searching ? (
						<LoaderCircle
							className="animate-spin text-blue-700"
							size={19}
							aria-hidden="true"
						/>
					) : null}
					{inputQuery ? (
						<button
							className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
							type="button"
							onClick={clearSearch}
							aria-label={text(copy("Clear search", "खोज साफ़ करें"))}
						>
							<X size={18} aria-hidden="true" />
						</button>
					) : null}
				</div>
				<p className="mt-2 text-sm text-slate-500">
					{needsMoreCharacters
						? text(
								copy(
									"Type one more character to search.",
									"खोजने के लिए एक और अक्षर लिखें।",
								),
							)
						: text(
								copy(
									"Results update as you type. Press Escape to clear.",
									"लिखते ही परिणाम बदलेंगे। साफ़ करने के लिए Escape दबाएँ।",
								),
							)}
				</p>
			</search>

			{error ? (
				<p
					className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900"
					role="alert"
				>
					{error}
				</p>
			) : null}
			{hasSearchQuery ? (
				<SearchResults
					query={normalizedQuery}
					results={searchResults}
					searching={searching}
				/>
			) : (
				<AuthorityList directory={directory} />
			)}
		</div>
	);
}

function AuthorityList({
	directory,
}: {
	directory: CatalogueDirectory | null;
}) {
	const { text } = useI18n();
	if (!directory) return <LoadingMessage />;
	return (
		<section aria-labelledby="authority-list-heading">
			<div className="mb-4 flex items-baseline justify-between gap-4">
				<h2
					id="authority-list-heading"
					className="text-xl font-bold text-blue-950"
				>
					{text(copy("Responsible authorities", "जिम्मेदार प्राधिकरण"))}
				</h2>
				<p className="text-sm tabular-nums text-slate-500">
					{text(
						copy(
							`${directory.authorities.length} available`,
							`${directory.authorities.length} उपलब्ध`,
						),
					)}
				</p>
			</div>
			<div className="border-y-2 border-blue-200">
				{directory.authorities.map((authority) => (
					<AuthorityCard authority={authority} key={authority.id} />
				))}
			</div>
		</section>
	);
}

function AuthorityCard({ authority }: { authority: CatalogueAuthority }) {
	const { text } = useI18n();
	return (
		<Link
			to="/services/$authoritySlug"
			params={{ authoritySlug: authority.slug }}
			className="group block border-b border-blue-200 px-1 py-6 last:border-b-0 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
		>
			<span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
				{text(copy("Authority", "प्राधिकरण"))}
			</span>
			<h3 className="mt-2 text-xl font-bold text-blue-950">
				{text(copy(authority.name, authority.name))}
			</h3>
			<span className="mt-4 inline-flex text-sm font-semibold text-blue-800 group-hover:text-blue-950">
				{text(copy("Browse grievance categories →", "शिकायत श्रेणियाँ देखें →"))}
			</span>
		</Link>
	);
}

function SearchResults({
	query,
	results,
	searching,
}: {
	query: string;
	results: CatalogueSearchResult[];
	searching: boolean;
}) {
	const { text } = useI18n();
	return (
		<section aria-labelledby="catalogue-results-heading" aria-busy={searching}>
			<div className="flex flex-wrap items-end justify-between gap-3 border-b border-blue-200 pb-4">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
						{text(copy("Search results", "खोज परिणाम"))}
					</p>
					<h2
						id="catalogue-results-heading"
						className="mt-1 text-xl font-semibold text-blue-950"
					>
						{text(copy(`Results for “${query}”`, `“${query}” के परिणाम`))}
					</h2>
				</div>
				<p className="text-sm font-medium text-slate-600">
					{text(copy(`${results.length} matches`, `${results.length} परिणाम`))}
				</p>
			</div>
			<output className="sr-only" aria-live="polite">
				{searching
					? text(copy("Searching the catalogue.", "निर्देशिका में खोज जारी है।"))
					: text(
							copy(
								`${results.length} results found.`,
								`${results.length} परिणाम मिले।`,
							),
						)}
			</output>
			{results.length ? (
				<div
					className={
						searching ? "opacity-60 transition-opacity" : "transition-opacity"
					}
				>
					{results.map((result) => (
						<Link
							className="group grid gap-3 border-b border-blue-200 px-1 py-5 transition-colors hover:bg-blue-50/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
							key={result.id}
							to="/services/$authoritySlug/form/$formId"
							search={{ review: false, draft: undefined }}
							params={{
								authoritySlug: result.authoritySlug,
								formId: result.id,
							}}
						>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-blue-700">
									{text(copy(result.authorityName, result.authorityName))}
								</p>
								<h3 className="mt-1 text-lg font-semibold text-blue-950">
									{text(copy(result.title, result.title))}
								</h3>
								<p className="mt-1 truncate text-sm text-slate-600">
									{text(
										copy(
											result.categoryPath.join(" / "),
											result.categoryPath.join(" / "),
										),
									)}
								</p>
							</div>
							<span className="text-sm font-semibold text-blue-800 group-hover:text-blue-950">
								{text(copy("Open form →", "फ़ॉर्म खोलें →"))}
							</span>
						</Link>
					))}
				</div>
			) : (
				<p className="border-b border-blue-200 py-6 text-slate-700">
					{text(
						copy(
							"No matching grievance categories. Try fewer words.",
							"शिकायत की कोई मिलती हुई श्रेणी नहीं मिली। कम शब्दों से फिर खोजें।",
						),
					)}
				</p>
			)}
		</section>
	);
}

export function AuthorityBrowser({ chunk }: { chunk: AuthorityChunk }) {
	const { text } = useI18n();
	const [filter, setFilter] = useState("");
	const roots = useMemo(
		() => chunk.categories.filter((category) => category.parentId === null),
		[chunk.categories],
	);
	const visible = filter.trim().toLocaleLowerCase();
	const categories = visible
		? chunk.categories.filter((category) =>
				`${category.name} ${category.path.join(" ")}`
					.toLocaleLowerCase()
					.includes(visible),
			)
		: roots;
	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
			<Link
				className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-800 no-underline hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
				to="/services"
				search={{ q: "" }}
			>
				<ArrowLeft size={17} aria-hidden="true" />
				{text(copy("Back to all authorities", "सभी प्राधिकरणों पर वापस जाएँ"))}
			</Link>
			<div className="mb-8 max-w-3xl">
				<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
					{text(copy("Choose a category", "श्रेणी चुनें"))}
				</p>
				<h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
					{text(copy(chunk.authority.name, chunk.authority.name))}
				</h1>
				<p className="mt-4 leading-7 text-slate-600">
					{text(
						copy(
							"Open a category to see the available grievance forms.",
							"उपलब्ध शिकायत फ़ॉर्म देखने के लिए श्रेणी खोलें।",
						),
					)}
				</p>
			</div>
			<label
				className="block max-w-xl text-sm font-semibold"
				htmlFor="category-filter"
			>
				{text(copy("Filter categories", "श्रेणियाँ फ़िल्टर करें"))}
				<input
					id="category-filter"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					className="mt-2 min-h-12 w-full border border-blue-300 bg-white px-4 text-blue-950 outline-none placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
					placeholder={text(
						copy("Try a grievance topic", "शिकायत का विषय लिखें"),
					)}
				/>
			</label>
			<div className="mt-8 border-y-2 border-blue-200">
				{categories.map((category) => (
					<CategoryCard category={category} chunk={chunk} key={category.id} />
				))}
				{!categories.length ? (
					<p className="py-5 text-slate-700">
						{text(
							copy(
								"No categories match that search.",
								"इस खोज से कोई श्रेणी नहीं मिली।",
							),
						)}
					</p>
				) : null}
			</div>
		</div>
	);
}

function CategoryCard({
	category,
	chunk,
}: {
	category: CatalogueCategory;
	chunk: AuthorityChunk;
}) {
	const { text } = useI18n();
	const children = chunk.categories.filter(
		(item) => item.parentId === category.id,
	);
	return (
		<details
			className="border-b border-blue-200 py-5 last:border-b-0"
			open={category.parentId === null}
		>
			<summary className="cursor-pointer list-none text-lg font-bold text-blue-950 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
				{text(copy(category.name, category.name))}
			</summary>
			<p className="mt-2 text-sm text-slate-600">
				{text(copy(category.path.join(" / "), category.path.join(" / ")))}
			</p>
			{category.formCapable && category.formId ? (
				<Link
					className="mt-4 inline-flex min-h-10 items-center border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					to="/services/$authoritySlug/form/$formId"
					search={{ review: false, draft: undefined }}
					params={{
						authoritySlug: chunk.authority.slug,
						formId: category.formId,
					}}
				>
					{text(copy("Open this grievance form", "यह शिकायत फ़ॉर्म खोलें"))}
				</Link>
			) : null}
			{children.length ? (
				<div className="ml-4 mt-4 border-l-2 border-blue-200 pl-4 sm:ml-6">
					{children.map((child) => (
						<CategoryCard category={child} chunk={chunk} key={child.id} />
					))}
				</div>
			) : null}
		</details>
	);
}

export function AuthorityPage({ slug }: { slug: string }) {
	const { text } = useI18n();
	const [chunk, setChunk] = useState<AuthorityChunk | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		setChunk(null);
		loadAuthorityChunk(slug)
			.then((value) => active && setChunk(value))
			.catch(
				() =>
					active &&
					setError(
						text(
							copy(
								"This authority could not be loaded.",
								"यह प्राधिकरण लोड नहीं हो सका।",
							),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [slug, text]);
	if (error)
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
				<p
					className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900"
					role="alert"
				>
					{error}
				</p>
				<Link
					className="mt-5 inline-flex items-center gap-2"
					to="/services"
					search={{ q: "" }}
				>
					<ArrowLeft size={17} aria-hidden="true" />
					{text(copy("Back to all authorities", "सभी प्राधिकरणों पर वापस जाएँ"))}
				</Link>
			</div>
		);
	return chunk ? <AuthorityBrowser chunk={chunk} /> : <LoadingMessage />;
}

export function FormPage({
	slug,
	formId,
	review,
	draftId,
}: {
	slug: string;
	formId: string;
	review: boolean;
	draftId?: string;
}) {
	const { text } = useI18n();
	const [form, setForm] = useState<CatalogueForm | null>(null);
	const [chunk, setChunk] = useState<AuthorityChunk | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		setForm(null);
		loadAuthorityChunk(slug)
			.then((value) => {
				if (!active) return;
				setChunk(value);
				const selected = findForm(value, formId);
				if (selected) setForm(selected);
				else
					setError(
						text(
							copy(
								"That grievance form is not available.",
								"यह शिकायत फ़ॉर्म उपलब्ध नहीं है।",
							),
						),
					);
			})
			.catch(
				() =>
					active &&
					setError(
						text(
							copy(
								"This grievance form could not be loaded.",
								"यह शिकायत फ़ॉर्म लोड नहीं हो सका।",
							),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [formId, slug, text]);
	if (error)
		return (
			<div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
				<p
					className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-red-900"
					role="alert"
				>
					{error}
				</p>
				<Link
					className="mt-5 inline-flex items-center gap-2"
					to="/services/$authoritySlug"
					params={{ authoritySlug: slug }}
				>
					<ArrowLeft size={17} aria-hidden="true" />
					{text(copy("Back to categories", "श्रेणियों पर वापस जाएँ"))}
				</Link>
			</div>
		);
	if (!form || !chunk) return <LoadingMessage />;
	return (
		<CatalogueFormScreen
			chunk={chunk}
			form={form}
			review={review}
			draftId={draftId}
		/>
	);
}

function CatalogueFormScreen({
	form,
	chunk,
	review,
	draftId,
}: {
	form: CatalogueForm;
	chunk: AuthorityChunk;
	review: boolean;
	draftId?: string;
}) {
	const { text, language } = useI18n();
	const navigate = useNavigate();
	const state = useCatalogueFormState(form);
	const { registerForm } = useAssistantContext();
	const { restore } = state;
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [restoring, setRestoring] = useState(Boolean(draftId));
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		registerForm({ form, values: state.values, setValue: state.setValue });
		return () => registerForm(null);
	}, [form, registerForm, state.setValue, state.values]);

	useEffect(() => {
		if (!draftId) {
			setRestoring(false);
			return;
		}
		let active = true;
		void import("#/features/drafts/functions")
			.then(({ getDraft }) => getDraft({ data: { draftId } }))
			.then((result) => {
				if (!active) return;
				if (
					result.form?.formKey !== form.id ||
					result.form.version !== form.version
				) {
					setSaveMessage(
						text(
							copy(
								"This draft belongs to a different form.",
								"यह मसौदा किसी दूसरे फ़ॉर्म का है।",
							),
						),
					);
					return;
				}
				const values = Object.fromEntries(
					Object.entries(result.draft.answers).flatMap(([key, value]) =>
						typeof value === "string" ? [[key, value]] : [],
					),
				);
				const attachments: Record<string, string[]> = {};
				for (const item of result.draft.attachmentMetadata) {
					if (
						typeof item !== "object" ||
						item === null ||
						Array.isArray(item)
					) {
						continue;
					}
					const fieldId = item.fieldId;
					const name = item.name;
					if (typeof fieldId !== "string" || typeof name !== "string") continue;
					attachments[fieldId] = [...(attachments[fieldId] ?? []), name];
				}
				restore({ values, attachments });
			})
			.catch(() => {
				if (!active) return;
				setSaveMessage(
					text(
						copy("This draft could not be loaded.", "यह मसौदा लोड नहीं हो सका।"),
					),
				);
			})
			.finally(() => {
				if (active) setRestoring(false);
			});
		return () => {
			active = false;
		};
	}, [draftId, form.id, form.version, restore, text]);
	const goReview = (event: FormEvent) => {
		event.preventDefault();
		if (state.validate())
			void navigate({ to: ".", search: { review: true, draft: draftId } });
	};
	const goEdit = () =>
		void navigate({ to: ".", search: { review: false, draft: draftId } });
	const save = async () => {
		if (saving || !state.validate()) return;
		setSaving(true);
		setSaveMessage(null);
		try {
			const {
				preservePendingCatalogueIntent,
				sanitizeReturnTarget,
				saveCatalogueDraft,
			} = await import("../client");
			const result = await saveCatalogueDraft({
				form,
				draftId,
				values: state.values,
				attachments: state.attachments,
				language,
			});
			if (result.ok) {
				setSaveMessage(text(copy("Draft saved.", "ड्राफ़्ट सहेजा गया।")));
				if (!draftId && result.draftId) {
					await navigate({
						to: ".",
						search: { review, draft: result.draftId },
						replace: true,
					});
				}
			} else {
				preservePendingCatalogueIntent({
					form,
					values: state.values,
					attachments: state.attachments,
					language,
				});
				await navigate({
					to: "/login",
					search: {
						redirect: sanitizeReturnTarget(
							window.location.pathname + window.location.search,
						),
					},
				});
			}
		} catch {
			setSaveMessage(
				text(
					copy(
						"The draft could not be saved. Try again.",
						"मसौदा सहेजा नहीं जा सका। फिर कोशिश करें।",
					),
				),
			);
		} finally {
			setSaving(false);
		}
	};
	if (restoring) return <LoadingMessage />;
	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
			<Link
				className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-800 no-underline hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
				to="/services/$authoritySlug"
				params={{ authoritySlug: chunk.authority.slug }}
			>
				<ArrowLeft size={17} aria-hidden="true" />
				{text(copy("Back to categories", "श्रेणियों पर वापस जाएँ"))}
			</Link>
			{review ? (
				<ReviewPanel
					form={form}
					state={state}
					onEdit={goEdit}
					onSave={() => void save()}
					saveMessage={saveMessage}
					saving={saving}
				/>
			) : (
				<form onSubmit={goReview} noValidate>
					<div className="mb-8 max-w-3xl">
						<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
							{text(copy("Grievance form", "शिकायत फ़ॉर्म"))}
						</p>
						<h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
							{text(copy(form.title, form.title))}
						</h1>
						<p className="mt-4 leading-7 text-slate-600">
							{text(
								copy(
									"Tell us what happened. You can save your progress on this device and return later.",
									"क्या हुआ, हमें बताएँ। आपकी प्रगति इस डिवाइस पर अपने आप सहेजी जाएगी।",
								),
							)}
						</p>
					</div>
					<div className="max-w-3xl border-t-2 border-blue-800 pt-6">
						<p className="border-l-4 border-blue-700 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
							{text(
								copy(
									"Please use clear details. Attachments stay on this device for now and are not uploaded.",
									"कृपया साफ़ जानकारी दें। अटैचमेंट अभी इस डिवाइस पर ही रहेंगे और अपलोड नहीं होंगे।",
								),
							)}
						</p>
						<div className="grid gap-6">
							{form.fields.map((field) => (
								<FieldControl
									field={field}
									key={field.id}
									values={state.values}
									attachments={state.attachments}
									errors={state.errors}
									onValue={state.setValue}
									onAttachment={state.setAttachment}
								/>
							))}
						</div>
						<div className="mt-8 flex flex-wrap gap-3">
							<button
								className="min-h-11 border border-blue-900 bg-blue-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
								type="submit"
							>
								{text(copy("Review details", "विवरण देखें"))}
							</button>
							<button
								className="min-h-11 border border-blue-700 bg-white px-5 py-2.5 font-semibold text-blue-900 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
								type="button"
								onClick={() => void save()}
								disabled={saving}
							>
								{text(
									saving
										? copy("Saving…", "सहेजा जा रहा है…")
										: copy("Save draft", "ड्राफ़्ट सहेजें"),
								)}
							</button>
							<button
								className="min-h-11 px-5 py-2.5 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
								type="button"
								onClick={state.reset}
							>
								{text(copy("Clear form", "फ़ॉर्म साफ़ करें"))}
							</button>
						</div>
						{saveMessage ? (
							<output className="mt-4 block text-sm font-semibold text-emerald-800">
								{saveMessage}
							</output>
						) : null}
					</div>
				</form>
			)}
		</div>
	);
}

function FieldControl({
	field,
	values,
	attachments,
	errors,
	onValue,
	onAttachment,
}: {
	field: CatalogueField;
	values: FormValues;
	attachments: Record<string, string[]>;
	errors: FormErrors;
	onValue: (id: string, value: string) => void;
	onAttachment: (id: string, names: string[]) => void;
}) {
	const { text } = useI18n();
	const label = text(copy(field.label, field.label));
	const error = errors[field.id];
	const describedBy = error ? `${field.id}-error` : undefined;
	const common = {
		id: field.id,
		name: field.id,
		"aria-invalid": Boolean(error),
		"aria-describedby": describedBy,
		required: field.required,
	};
	return (
		<div className="border-b border-blue-100 pb-6 last:border-b-0">
			<label className="block text-sm font-semibold" htmlFor={field.id}>
				{label}
				{field.required ? (
					<span className="ml-1 text-red-700" aria-hidden="true">
						*
					</span>
				) : null}
			</label>
			{field.kind === "select" ? (
				<select
					{...common}
					value={values[field.id] ?? ""}
					onChange={(event) => onValue(field.id, event.target.value)}
					className="mt-2 min-h-12 w-full border border-blue-300 bg-white px-4 text-blue-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
				>
					<option value="">
						{text(copy("Select an option", "एक विकल्प चुनें"))}
					</option>
					{(field.options ?? []).map((option) => (
						<option key={option} value={option}>
							{text(copy(option, option))}
						</option>
					))}
				</select>
			) : field.kind === "textarea" ? (
				<textarea
					{...common}
					value={values[field.id] ?? ""}
					onChange={(event) => onValue(field.id, event.target.value)}
					maxLength={field.maximumLength}
					placeholder={
						field.placeholder
							? text(copy(field.placeholder, field.placeholder))
							: undefined
					}
					className="mt-2 min-h-36 w-full border border-blue-300 bg-white p-4 text-blue-950 outline-none placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
				/>
			) : field.kind === "file" ? (
				<input
					{...common}
					type="file"
					multiple
					onChange={(event) =>
						onAttachment(
							field.id,
							Array.from(event.target.files ?? [], (file) => file.name),
						)
					}
					className="mt-2 block min-h-12 w-full border border-dashed border-blue-500 bg-blue-50 p-3 text-sm text-blue-950 file:mr-4 file:border-0 file:bg-blue-900 file:px-3 file:py-2 file:font-semibold file:text-white"
				/>
			) : (
				<input
					{...common}
					type={field.kind === "number" ? "number" : "text"}
					value={values[field.id] ?? ""}
					onChange={(event) => onValue(field.id, event.target.value)}
					maxLength={field.maximumLength}
					pattern={field.pattern}
					placeholder={
						field.placeholder
							? text(copy(field.placeholder, field.placeholder))
							: undefined
					}
					className="mt-2 min-h-12 w-full border border-blue-300 bg-white px-4 text-blue-950 outline-none placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
				/>
			)}
			{field.kind === "file" && attachments[field.id]?.length ? (
				<p className="mt-2 text-sm text-slate-600">
					{text(
						copy(
							`${attachments[field.id].length} file(s) selected`,
							`${attachments[field.id].length} फ़ाइल चुनी गई`,
						),
					)}
				</p>
			) : null}
			{field.maximumLength ? (
				<p className="mt-2 text-xs text-slate-600">
					{text(
						copy(
							`Up to ${field.maximumLength} characters.`,
							`${field.maximumLength} अक्षरों तक।`,
						),
					)}
				</p>
			) : null}
			{error ? (
				<p
					id={describedBy}
					className="mt-2 text-sm font-semibold text-red-700"
					role="alert"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}

function ReviewPanel({
	form,
	state,
	onEdit,
	onSave,
	saveMessage,
	saving,
}: {
	form: CatalogueForm;
	state: ReturnType<typeof useCatalogueFormState>;
	onEdit: () => void;
	onSave: () => void;
	saveMessage: string | null;
	saving: boolean;
}) {
	const { text } = useI18n();
	return (
		<div className="max-w-3xl">
			<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
				{text(copy("Final review", "अंतिम समीक्षा"))}
			</p>
			<h1 className="mt-3 text-4xl font-bold tracking-tight text-blue-950 md:text-5xl">
				{text(copy("Check your details", "अपने विवरण जाँचें"))}
			</h1>
			<p className="mt-4 leading-7 text-slate-600">
				{text(
					copy(
						"Review the details before saving this draft.",
						"इस मसौदे को सहेजने से पहले विवरण जाँचें।",
					),
				)}
			</p>
			<dl className="mt-8 border-y-2 border-blue-200">
				{form.fields.map((field) => (
					<div
						className="grid gap-1 border-b border-blue-200 py-4 last:border-b-0 sm:grid-cols-[minmax(10rem,0.45fr)_1fr]"
						key={field.id}
					>
						<dt className="text-sm font-semibold text-slate-600">
							{text(copy(field.label, field.label))}
						</dt>
						<dd className="whitespace-pre-wrap break-words">
							{fieldHasValue(field, state.values, state.attachments)
								? field.kind === "file"
									? state.attachments[field.id]?.join(", ")
									: state.values[field.id]
								: text(copy("Not provided", "नहीं दिया गया"))}
						</dd>
					</div>
				))}
				<div className="mt-8 flex flex-wrap gap-3">
					<button
						className="min-h-11 border border-blue-700 bg-white px-5 py-2.5 font-semibold text-blue-900 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
						type="button"
						onClick={onEdit}
					>
						{text(copy("Edit details", "विवरण बदलें"))}
					</button>
					<button
						className="min-h-11 border border-blue-900 bg-blue-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
						type="button"
						onClick={onSave}
						disabled={saving}
					>
						{text(
							saving
								? copy("Saving…", "सहेजा जा रहा है…")
								: copy("Save draft", "ड्राफ़्ट सहेजें"),
						)}
					</button>
				</div>
				{saveMessage ? (
					<output className="mt-4 block text-sm font-semibold text-emerald-800">
						{saveMessage}
					</output>
				) : null}
			</dl>
		</div>
	);
}

function LoadingMessage() {
	const { text } = useI18n();
	return (
		<output className="mx-auto block w-full max-w-6xl border-y-2 border-blue-200 px-4 py-6 text-sm font-medium text-slate-700 sm:px-6 lg:px-8">
			{text(
				copy("Loading grievance categories…", "शिकायत श्रेणियाँ लोड हो रही हैं…"),
			)}
		</output>
	);
}
