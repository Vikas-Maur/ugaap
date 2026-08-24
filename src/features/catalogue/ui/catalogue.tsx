import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronDown,
	ChevronRight,
	ChevronsUpDown,
	LoaderCircle,
	Search,
	X,
} from "lucide-react";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "#/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useAssistantContext } from "#/features/assistant/context";
import {
	attachmentExtension,
	expectedMimeForExtension,
	MAX_ATTACHMENT_BYTES,
	type ReadyAttachment,
} from "#/features/attachments/constants";

import { submitGrievance } from "#/features/grievances/functions";
import { text, useI18n } from "#/features/i18n/i18n";

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
	type AttachmentState,
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

function createIdempotencyKey() {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	);
}

type AttachmentUploadState = {
	fieldId: string;
	progress: number;
	error: string | null;
} | null;

async function checksumFile(file: File) {
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		await file.arrayBuffer(),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function submissionErrorText(error: unknown) {
	const message = error instanceof Error ? error.message : "";
	if (/attachment.*(?:upload|ready)|attachment metadata/i.test(message)) {
		return text({
			en: "The selected attachment has not finished uploading.",
			hi: "चुना गया संलग्नक अभी अपलोड नहीं हुआ है।",
		});
	}
	if (/review is stale/i.test(message)) {
		return text({
			en: "The draft changed after review. Check the details and submit again.",
			hi: "समीक्षा के बाद मसौदा बदल गया। विवरण जाँचकर फिर से जमा करें।",
		});
	}
	if (/form is no longer available/i.test(message)) {
		return text({
			en: "This form is no longer available. Choose the grievance route again.",
			hi: "यह फ़ॉर्म अब उपलब्ध नहीं है। शिकायत का मार्ग फिर से चुनें।",
		});
	}
	return text({
		en: "The grievance could not be submitted. Try again.",
		hi: "शिकायत जमा नहीं हो सकी। कृपया फिर से कोशिश करें।",
	});
}

export function DirectoryBrowser({
	query,
	onQueryCommit,
}: {
	query: string;
	onQueryCommit: (query: string) => void;
}) {
	const { text: translate } = useI18n();
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
						translate(
							text({
								en: "We could not load the grievance directory.",
								hi: "शिकायत निर्देशिका लोड नहीं हो सकी।",
							}),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [translate]);

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
					translate(
						text({
							en: "Search is unavailable right now.",
							hi: "अभी खोज उपलब्ध नहीं है।",
						}),
					),
				);
			})
			.finally(() => {
				if (searchRequest.current === request) setSearching(false);
			});
	}, [normalizedQuery, translate]);

	const clearSearch = () => {
		setInputQuery("");
		onQueryCommit("");
	};
	const hasSearchQuery = normalizedQuery.length >= MIN_CATALOGUE_QUERY_LENGTH;
	const needsMoreCharacters =
		inputQuery.trim().length > 0 &&
		inputQuery.trim().length < MIN_CATALOGUE_QUERY_LENGTH;

	return (
		<div className="page-shell">
			<h1 className="sr-only">
				{translate(
					text({ en: "Find a grievance category", hi: "शिकायत श्रेणी खोजें" }),
				)}
			</h1>
			<search className="mb-7">
				<label className="sr-only" htmlFor="service-search">
					{translate(
						text({
							en: "Search grievance categories",
							hi: "शिकायत श्रेणियाँ खोजें",
						}),
					)}
				</label>
				<div className="search-control">
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
						placeholder={translate(
							text({
								en: "Try: passport delay, pension, broadband",
								hi: "जैसे: पासपोर्ट में देरी, पेंशन, ब्रॉडबैंड",
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
					{inputQuery ? (
						<button
							className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
							type="button"
							onClick={clearSearch}
							aria-label={translate(
								text({ en: "Clear search", hi: "खोज साफ़ करें" }),
							)}
						>
							<X size={18} aria-hidden="true" />
						</button>
					) : null}
				</div>
				<p className="mt-2 text-sm text-slate-500">
					{needsMoreCharacters
						? translate(
								text({
									en: "Type one more character to search.",
									hi: "खोजने के लिए एक और अक्षर लिखें।",
								}),
							)
						: translate(
								text({
									en: "Results update as you type. Press Escape to clear.",
									hi: "लिखते ही परिणाम बदलेंगे। साफ़ करने के लिए Escape दबाएँ।",
								}),
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
	const { text: translate } = useI18n();
	if (!directory) return <LoadingMessage />;
	return (
		<section aria-labelledby="authority-list-heading">
			<div className="mb-4 flex items-baseline justify-between gap-4">
				<h2
					id="authority-list-heading"
					className="text-xl font-semibold tracking-[-0.02em] text-blue-950"
				>
					{translate(
						text({ en: "Responsible authorities", hi: "जिम्मेदार प्राधिकरण" }),
					)}
				</h2>
				<p className="text-sm tabular-nums text-slate-500">
					{translate(
						text({
							en: `${directory.authorities.length} available`,
							hi: `${directory.authorities.length} उपलब्ध`,
						}),
					)}
				</p>
			</div>
			<div className="grid gap-2">
				{directory.authorities.map((authority) => (
					<AuthorityCard authority={authority} key={authority.id} />
				))}
			</div>
		</section>
	);
}

function AuthorityCard({ authority }: { authority: CatalogueAuthority }) {
	return (
		<Link
			to="/services/$authoritySlug"
			params={{ authoritySlug: authority.slug }}
			search={{ form: undefined, review: false, draft: undefined }}
			className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4 transition-[border-color,background-color] hover:border-[var(--blue-300)] hover:bg-[var(--blue-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
		>
			<h3 className="text-base font-semibold tracking-[-0.01em] text-blue-950 sm:text-lg">
				{authority.name}
			</h3>
			<ChevronRight
				className="text-blue-700 transition-transform group-hover:translate-x-0.5"
				size={20}
				aria-hidden="true"
			/>
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
	const { text: translate } = useI18n();
	return (
		<section aria-labelledby="catalogue-results-heading" aria-busy={searching}>
			<div className="flex flex-wrap items-end justify-between gap-3 pb-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-800">
						{translate(text({ en: "Search results", hi: "खोज परिणाम" }))}
					</p>
					<h2
						id="catalogue-results-heading"
						className="mt-1 text-xl font-semibold text-blue-950"
					>
						{translate(
							text({ en: `Results for “${query}”`, hi: `“${query}” के परिणाम` }),
						)}
					</h2>
				</div>
				<p className="text-sm font-medium text-slate-600">
					{translate(
						text({
							en: `${results.length} matches`,
							hi: `${results.length} परिणाम`,
						}),
					)}
				</p>
			</div>
			<output className="sr-only" aria-live="polite">
				{searching
					? translate(
							text({
								en: "Searching the catalogue.",
								hi: "निर्देशिका में खोज जारी है।",
							}),
						)
					: translate(
							text({
								en: `${results.length} results found.`,
								hi: `${results.length} परिणाम मिले।`,
							}),
						)}
			</output>
			{results.length ? (
				<div
					className={
						searching
							? "grid gap-2 opacity-60 transition-opacity"
							: "grid gap-2 transition-opacity"
					}
				>
					{results.map((result) => (
						<Link
							className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4 transition-[border-color,background-color] hover:border-[var(--blue-300)] hover:bg-[var(--blue-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
							key={result.id}
							to="/services/$authoritySlug"
							search={{ form: result.id, review: false, draft: undefined }}
							params={{
								authoritySlug: result.authoritySlug,
							}}
						>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-blue-700">
									{translate(
										text({
											en: result.authorityName,
											hi: result.authorityName,
										}),
									)}
								</p>
								<h3 className="mt-1 text-lg font-semibold text-blue-950">
									{translate(text({ en: result.title, hi: result.title }))}
								</h3>
								<p className="mt-1 truncate text-sm text-slate-600">
									{translate(
										text({
											en: result.categoryPath.join(" / "),
											hi: result.categoryPath.join(" / "),
										}),
									)}
								</p>
							</div>
							<ChevronRight
								className="text-blue-700 transition-transform group-hover:translate-x-0.5"
								size={20}
								aria-hidden="true"
							/>
						</Link>
					))}
				</div>
			) : (
				<p className="py-6 text-slate-700">
					{translate(
						text({
							en: "No matching grievance categories. Try fewer words.",
							hi: "शिकायत की कोई मिलती हुई श्रेणी नहीं मिली। कम शब्दों से फिर खोजें।",
						}),
					)}
				</p>
			)}
		</section>
	);
}

export function AuthorityBrowser({ chunk }: { chunk: AuthorityChunk }) {
	const { text: translate } = useI18n();
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
		<div className="page-shell">
			<Link
				className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-800 no-underline hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
				to="/services"
				search={{ q: "" }}
			>
				<ArrowLeft size={17} aria-hidden="true" />
				{translate(
					text({
						en: "Back to all authorities",
						hi: "सभी प्राधिकरणों पर वापस जाएँ",
					}),
				)}
			</Link>
			<div className="mb-8">
				<p className="page-eyebrow">
					{translate(text({ en: "Choose a category", hi: "श्रेणी चुनें" }))}
				</p>
				<h1 className="page-title">
					{translate(
						text({ en: chunk.authority.name, hi: chunk.authority.name }),
					)}
				</h1>
				<p className="page-intro">
					{translate(
						text({
							en: "Open a category to see the available grievance forms.",
							hi: "उपलब्ध शिकायत फ़ॉर्म देखने के लिए श्रेणी खोलें।",
						}),
					)}
				</p>
			</div>
			<label
				className="block max-w-xl text-sm font-semibold"
				htmlFor="category-filter"
			>
				{translate(text({ en: "Filter categories", hi: "श्रेणियाँ फ़िल्टर करें" }))}
				<span className="search-control mt-2">
					<Search
						className="shrink-0 text-blue-700"
						size={19}
						aria-hidden="true"
					/>
					<input
						id="category-filter"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						className="min-w-0 flex-1 bg-transparent text-base font-normal text-blue-950 outline-none placeholder:text-slate-500"
						placeholder={translate(
							text({ en: "Try a grievance topic", hi: "शिकायत का विषय लिखें" }),
						)}
					/>
				</span>
			</label>
			<div className="mt-7 grid gap-2">
				{categories.map((category) => (
					<CategoryCard category={category} chunk={chunk} key={category.id} />
				))}
				{!categories.length ? (
					<p className="py-5 text-slate-700">
						{translate(
							text({
								en: "No categories match that search.",
								hi: "इस खोज से कोई श्रेणी नहीं मिली।",
							}),
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
	const { text: translate } = useI18n();
	const children = chunk.categories.filter(
		(item) => item.parentId === category.id,
	);
	return (
		<details className="category-disclosure">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-4 text-base font-semibold text-blue-950 transition-[border-color,background-color] marker:content-none hover:border-[var(--blue-300)] hover:bg-[var(--blue-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:text-lg">
				<span>{translate(text({ en: category.name, hi: category.name }))}</span>
				<ChevronDown
					className="shrink-0 text-blue-700 transition-transform"
					size={20}
					aria-hidden="true"
				/>
			</summary>
			<p className="mx-1 mt-2 text-sm text-slate-600">
				{translate(
					text({
						en: category.path.join(" / "),
						hi: category.path.join(" / "),
					}),
				)}
			</p>
			{category.formCapable && category.formId ? (
				<Link
					className="action-primary mt-4 min-h-10 px-4 no-underline"
					to="/services/$authoritySlug"
					search={{
						form: category.formId,
						review: false,
						draft: undefined,
					}}
					params={{
						authoritySlug: chunk.authority.slug,
					}}
				>
					{translate(
						text({ en: "Open this grievance form", hi: "यह शिकायत फ़ॉर्म खोलें" }),
					)}
					<ChevronRight size={17} aria-hidden="true" />
				</Link>
			) : null}
			{children.length ? (
				<div className="mt-2 grid gap-2">
					{children.map((child) => (
						<CategoryCard category={child} chunk={chunk} key={child.id} />
					))}
				</div>
			) : null}
		</details>
	);
}

function categorySelectionForForm(
	chunk: AuthorityChunk,
	formId: string | undefined,
): string[] {
	if (!formId) return [];
	const form = findForm(chunk, formId);
	if (!form) return [];
	const categoryById = new Map(
		chunk.categories.map((category) => [category.id, category]),
	);
	const path: string[] = [];
	let category = categoryById.get(form.categoryId);
	while (category) {
		path.unshift(category.id);
		category = category.parentId
			? categoryById.get(category.parentId)
			: undefined;
	}
	if (!path.length) return [];
	for (let index = 1; index < path.length; index += 1) {
		const child = categoryById.get(path[index] ?? "");
		if (child?.parentId !== path[index - 1]) return [];
	}
	return path;
}

function categoryLevels(chunk: AuthorityChunk, selectedIds: string[]) {
	const levels: Array<{
		options: CatalogueCategory[];
		value: string | undefined;
	}> = [];
	let options = chunk.categories.filter(
		(category) => category.parentId === null,
	);
	let level = 0;
	while (options.length) {
		const value = selectedIds[level];
		levels.push({ options, value });
		if (!value) break;
		const selected = options.find((category) => category.id === value);
		if (!selected) break;
		options = chunk.categories.filter(
			(category) => category.parentId === selected.id,
		);
		level += 1;
	}
	return levels;
}

export function AuthorityPage({
	slug,
	formId,
	review,
	draftId,
}: {
	slug: string;
	formId?: string;
	review: boolean;
	draftId?: string;
}) {
	const { text: translate } = useI18n();
	const navigate = useNavigate();
	const [chunk, setChunk] = useState<AuthorityChunk | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const manualUrlUpdate = useRef<{ formId: string | undefined } | null>(null);
	useEffect(() => {
		let active = true;
		setChunk(null);
		setError(null);
		loadAuthorityChunk(slug)
			.then((value) => active && setChunk(value))
			.catch(
				() =>
					active &&
					setError(
						translate(
							text({
								en: "This authority could not be loaded.",
								hi: "यह प्राधिकरण लोड नहीं हो सका।",
							}),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [slug, translate]);

	useEffect(() => {
		if (!chunk) return;
		if (manualUrlUpdate.current?.formId === formId) {
			manualUrlUpdate.current = null;
			return;
		}
		manualUrlUpdate.current = null;
		setSelectedIds(categorySelectionForForm(chunk, formId));
	}, [chunk, formId]);

	if (error)
		return (
			<div className="page-shell">
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
					{translate(
						text({
							en: "Back to all authorities",
							hi: "सभी प्राधिकरणों पर वापस जाएँ",
						}),
					)}
				</Link>
			</div>
		);
	if (!chunk) return <LoadingMessage page />;

	const levels = categoryLevels(chunk, selectedIds);
	const selectedCategory = chunk.categories.find(
		(category) => category.id === selectedIds.at(-1),
	);
	const selectedForm =
		selectedCategory?.formCapable && selectedCategory.formId
			? findForm(chunk, selectedCategory.formId)
			: undefined;
	const invalidRequestedForm = Boolean(
		formId && !categorySelectionForForm(chunk, formId).length,
	);

	const selectCategory = (level: number, categoryId: string) => {
		const nextIds = [...selectedIds.slice(0, level), categoryId];
		const category = chunk.categories.find((item) => item.id === categoryId);
		const nextForm =
			category?.formCapable && category.formId
				? findForm(chunk, category.formId)
				: undefined;
		setSelectedIds(nextIds);
		manualUrlUpdate.current = { formId: nextForm?.id };
		void navigate({
			to: "/services/$authoritySlug",
			params: { authoritySlug: chunk.authority.slug },
			search: {
				form: nextForm?.id,
				review: false,
				draft: undefined,
			},
			replace: true,
			resetScroll: false,
		});
	};

	const selectors = (
		<CategorySelectors levels={levels} onSelect={selectCategory} />
	);

	return (
		<div className="page-shell">
			<div className="w-full">
				<Link
					className="mb-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-800 no-underline hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
					to="/services"
					search={{ q: "" }}
				>
					<ArrowLeft size={17} aria-hidden="true" />
					{translate(
						text({
							en: "Back to all authorities",
							hi: "सभी प्राधिकरणों पर वापस जाएं",
						}),
					)}
				</Link>
				<header className="mb-10">
					<h1 className="page-title mt-0">
						{translate(
							text({ en: chunk.authority.name, hi: chunk.authority.name }),
						)}
					</h1>
				</header>
				{invalidRequestedForm ? (
					<output className="mb-7 border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-950">
						{translate(
							text({
								en: "The requested category is not available. Choose another category below.",
								hi: "अनुरोधित श्रेणी उपलब्ध नहीं है। नीचे कोई दूसरी श्रेणी चुनें।",
							}),
						)}
					</output>
				) : null}
				{selectedForm ? (
					<CatalogueFormScreen
						categoryControls={selectors}
						form={selectedForm}
						authorityName={chunk.authority.name}
						review={review}
						draftId={draftId}
					/>
				) : (
					<form noValidate>{selectors}</form>
				)}
			</div>
		</div>
	);
}

function CategorySelectors({
	levels,
	onSelect,
}: {
	levels: Array<{
		options: CatalogueCategory[];
		value: string | undefined;
	}>;
	onSelect: (level: number, categoryId: string) => void;
}) {
	const { text: translate } = useI18n();
	const nextLevel = levels.findIndex((level) => !level.value);
	return (
		<fieldset className="mb-9 grid gap-6 border-0 p-0">
			<legend className="sr-only">
				{translate(
					text({ en: "Choose a grievance category", hi: "शिकायत की श्रेणी चुनें" }),
				)}
			</legend>
			{levels.map((level, index) => (
				<CategoryCombobox
					key={index === 0 ? "category" : `subcategory-${index}`}
					label={
						index === 0
							? translate(text({ en: "Category", hi: "श्रेणी" }))
							: translate(
									text({ en: `Sub-category ${index}`, hi: `उप-श्रेणी ${index}` }),
								)
					}
					options={level.options}
					value={level.value}
					onChange={(categoryId) => onSelect(index, categoryId)}
				/>
			))}
			<p className="sr-only" aria-live="polite">
				{nextLevel > 0
					? translate(
							text({
								en: `Sub-category ${nextLevel} is ready to choose.`,
								hi: `उप-श्रेणी ${nextLevel} चुनने के लिए तैयार है।`,
							}),
						)
					: ""}
			</p>
		</fieldset>
	);
}

function CategoryCombobox({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: CatalogueCategory[];
	value?: string;
	onChange: (categoryId: string) => void;
}) {
	const { text: translate } = useI18n();
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.id === value);
	const controlId = `category-${options[0]?.parentId ?? "root"}`;
	return (
		<div>
			<label className="block text-sm font-semibold" htmlFor={controlId}>
				{label}
				<span className="ml-1 text-red-700" aria-hidden="true">
					*
				</span>
			</label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						id={controlId}
						type="button"
						role="combobox"
						aria-expanded={open}
						aria-required="true"
						className="field-control mt-2 flex items-center justify-between gap-3 text-left"
					>
						<span className={selected ? "truncate" : "truncate text-slate-500"}>
							{selected
								? translate(text({ en: selected.name, hi: selected.name }))
								: translate(
										text({
											en: "Search or choose an option",
											hi: "विकल्प खोजें या चुनें",
										}),
									)}
						</span>
						<ChevronsUpDown
							className="shrink-0 text-blue-700"
							size={18}
							aria-hidden="true"
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[var(--radix-popover-trigger-width)] p-0"
					align="start"
				>
					<Command>
						<CommandInput
							placeholder={translate(
								text({ en: "Search options", hi: "विकल्प खोजें" }),
							)}
						/>
						<CommandList className="max-h-72">
							<CommandEmpty>
								{translate(
									text({
										en: "No matching options.",
										hi: "कोई मिलता विकल्प नहीं है।",
									}),
								)}
							</CommandEmpty>
							<CommandGroup>
								{options.map((option) => (
									<CommandItem
										key={option.id}
										value={`${option.name} ${option.path.join(" ")}`}
										onSelect={() => {
											onChange(option.id);
											setOpen(false);
										}}
									>
										<Check
											className={
												option.id === value ? "opacity-100" : "opacity-0"
											}
											size={16}
											aria-hidden="true"
										/>
										<span>
											{translate(text({ en: option.name, hi: option.name }))}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
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
	const { text: translate } = useI18n();
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
						translate(
							text({
								en: "That grievance form is not available.",
								hi: "यह शिकायत फ़ॉर्म उपलब्ध नहीं है।",
							}),
						),
					);
			})
			.catch(
				() =>
					active &&
					setError(
						translate(
							text({
								en: "This grievance form could not be loaded.",
								hi: "यह शिकायत फ़ॉर्म लोड नहीं हो सका।",
							}),
						),
					),
			);
		return () => {
			active = false;
		};
	}, [formId, slug, translate]);
	if (error)
		return (
			<div className="page-shell">
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
					search={{ form: undefined, review: false, draft: undefined }}
				>
					<ArrowLeft size={17} aria-hidden="true" />
					{translate(
						text({ en: "Back to categories", hi: "श्रेणियों पर वापस जाएँ" }),
					)}
				</Link>
			</div>
		);
	if (!form || !chunk) return <LoadingMessage page />;
	return (
		<CatalogueFormScreen
			categoryControls={null}
			form={form}
			authorityName={chunk.authority.name}
			review={review}
			draftId={draftId}
		/>
	);
}

function CatalogueFormScreen({
	form,
	authorityName,
	categoryControls,
	review,
	draftId,
}: {
	form: CatalogueForm;
	authorityName: string;
	categoryControls: ReactNode;
	review: boolean;
	draftId?: string;
}) {
	const { text: translate, language } = useI18n();
	const navigate = useNavigate();
	const state = useCatalogueFormState(form);
	const { registerForm } = useAssistantContext();
	const { restore } = state;
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [saveError, setSaveError] = useState(false);
	const [restoring, setRestoring] = useState(Boolean(draftId));
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [attachmentUpload, setAttachmentUpload] =
		useState<AttachmentUploadState>(null);
	const submissionKey = useRef<string | null>(null);

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
						translate(
							text({
								en: "This draft belongs to a different form.",
								hi: "यह मसौदा किसी दूसरे फ़ॉर्म का है।",
							}),
						),
					);
					return;
				}
				const values = Object.fromEntries(
					Object.entries(result.draft.answers).flatMap(([key, value]) =>
						typeof value === "string" ? [[key, value]] : [],
					),
				);
				const attachments: AttachmentState = {};
				for (const item of result.draft.attachmentMetadata) {
					if (
						typeof item !== "object" ||
						item === null ||
						Array.isArray(item)
					) {
						continue;
					}
					const attachmentId = item.attachmentId;
					const fieldId = item.fieldId;
					const name = item.name;
					const mimeType = item.mimeType;
					const sizeBytes = item.sizeBytes;
					if (
						typeof attachmentId !== "string" ||
						typeof fieldId !== "string" ||
						typeof name !== "string" ||
						!["application/pdf", "image/jpeg", "image/png"].includes(
							String(mimeType),
						) ||
						typeof sizeBytes !== "number"
					)
						continue;
					attachments[fieldId] = [
						{
							id: attachmentId,
							fieldId,
							name,
							mimeType: mimeType as ReadyAttachment["mimeType"],
							sizeBytes,
						},
					];
				}
				restore({ values, attachments });
			})
			.catch(() => {
				if (!active) return;
				setSaveMessage(
					translate(
						text({
							en: "This draft could not be loaded.",
							hi: "यह मसौदा लोड नहीं हो सका।",
						}),
					),
				);
			})
			.finally(() => {
				if (active) setRestoring(false);
			});
		return () => {
			active = false;
		};
	}, [draftId, form.id, form.version, restore, translate]);
	const goReview = (event: FormEvent) => {
		event.preventDefault();
		if (state.validate())
			void navigate({
				to: ".",
				search: (previous) => ({
					...previous,
					review: true,
					draft: draftId,
				}),
			});
	};
	const goEdit = () =>
		void navigate({
			to: ".",
			search: (previous) => ({
				...previous,
				review: false,
				draft: draftId,
			}),
		});
	const save = async ({
		validate = true,
		attachments = state.attachments,
		quiet = false,
		targetDraftId = draftId,
	}: {
		validate?: boolean;
		attachments?: AttachmentState;
		quiet?: boolean;
		targetDraftId?: string;
	} = {}) => {
		if (saving || (validate && !state.validate())) return;
		setSaving(true);
		if (!quiet) setSaveMessage(null);
		setSaveError(false);
		try {
			const {
				preservePendingCatalogueIntent,
				sanitizeReturnTarget,
				saveCatalogueDraft,
			} = await import("../client");
			const result = await saveCatalogueDraft({
				form,
				draftId: targetDraftId,
				values: state.values,
				attachments,
				language,
			});
			if (result.ok) {
				if (!quiet)
					setSaveMessage(
						translate(text({ en: "Draft saved.", hi: "ड्राफ़्ट सहेजा गया।" })),
					);
				if (!targetDraftId && result.draftId) {
					await navigate({
						to: ".",
						search: (previous) => ({
							...previous,
							review,
							draft: result.draftId,
						}),
						replace: true,
					});
				}
				return result;
			} else {
				preservePendingCatalogueIntent({
					form,
					values: state.values,
					attachments,
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
			setSaveError(true);
			if (!quiet)
				setSaveMessage(
					translate(
						text({
							en: "The draft could not be saved. Try again.",
							hi: "मसौदा सहेजा नहीं जा सका। फिर कोशिश करें।",
						}),
					),
				);
		} finally {
			setSaving(false);
		}
	};
	const uploadAttachment = async (fieldId: string, file: File) => {
		if (attachmentUpload || saving || submitting) return;
		const extension = attachmentExtension(file.name);
		const expectedMime = expectedMimeForExtension(extension);
		if (
			!expectedMime ||
			file.type !== expectedMime ||
			file.size <= 0 ||
			file.size > MAX_ATTACHMENT_BYTES
		) {
			setSaveError(true);
			setSaveMessage(
				translate(
					text({
						en: "Choose one PDF, JPEG, or PNG file no larger than 5 MB.",
						hi: "5 MB तक की एक PDF, JPEG या PNG फ़ाइल चुनें।",
					}),
				),
			);
			return;
		}
		setAttachmentUpload({ fieldId, progress: 0, error: null });
		setSaveError(false);
		setSaveMessage(null);
		let preparedId: string | null = null;
		try {
			const currentAttachments = Object.values(state.attachments).flat();
			const { finalizeAttachment, prepareAttachment, removeAttachment } =
				await import("#/features/attachments/functions");
			for (const current of currentAttachments) {
				await removeAttachment({ data: { attachmentId: current.id } });
			}
			const emptyAttachments: AttachmentState = {};
			for (const currentFieldId of Object.keys(state.attachments))
				state.setAttachment(currentFieldId, []);
			const saved = await save({
				validate: false,
				attachments: emptyAttachments,
				quiet: true,
			});
			if (!saved?.ok) return;
			const checksum = await checksumFile(file);
			const prepared = await prepareAttachment({
				data: {
					draftId: saved.draftId,
					fieldId,
					name: file.name,
					mimeType: expectedMime,
					sizeBytes: file.size,
					checksum,
				},
			});
			preparedId = prepared.attachmentId;
			const { upload } = await import("@vercel/blob/client");
			await upload(prepared.pathname, file, {
				access: "private",
				contentType: expectedMime,
				handleUploadUrl: "/api/attachments/upload",
				clientPayload: JSON.stringify({
					attachmentId: prepared.attachmentId,
				}),
				onUploadProgress: ({ percentage }) =>
					setAttachmentUpload({
						fieldId,
						progress: Math.round(percentage),
						error: null,
					}),
			});
			const ready = await finalizeAttachment({
				data: { attachmentId: prepared.attachmentId },
			});
			const nextAttachments: AttachmentState = { [fieldId]: [ready] };
			state.setAttachment(fieldId, [ready]);
			const savedWithAttachment = await save({
				validate: false,
				attachments: nextAttachments,
				quiet: true,
				targetDraftId: saved.draftId,
			});
			if (!savedWithAttachment?.ok)
				throw new Error("Attachment metadata could not be saved");
			setSaveMessage(
				translate(
					text({
						en: "Attachment uploaded and checked.",
						hi: "संलग्नक अपलोड और जाँच कर लिया गया।",
					}),
				),
			);
		} catch {
			state.setAttachment(fieldId, []);
			if (preparedId) {
				const { removeAttachment } = await import(
					"#/features/attachments/functions"
				);
				await removeAttachment({
					data: { attachmentId: preparedId },
				}).catch(() => undefined);
			}
			setSaveError(true);
			setSaveMessage(
				translate(
					text({
						en: "The attachment could not be uploaded or verified. Try again.",
						hi: "संलग्नक अपलोड या सत्यापित नहीं हो सका। फिर से कोशिश करें।",
					}),
				),
			);
		} finally {
			setAttachmentUpload(null);
		}
	};
	const removeReadyAttachment = async (
		fieldId: string,
		item: ReadyAttachment,
	) => {
		if (attachmentUpload || saving || submitting) return;
		setAttachmentUpload({ fieldId, progress: 0, error: null });
		setSaveError(false);
		try {
			const { removeAttachment } = await import(
				"#/features/attachments/functions"
			);
			await removeAttachment({ data: { attachmentId: item.id } });
			state.setAttachment(fieldId, []);
			const nextAttachments = Object.fromEntries(
				Object.entries(state.attachments)
					.filter(([key]) => key !== fieldId)
					.map(([key, items]) => [key, items]),
			) as AttachmentState;
			if (draftId)
				await save({
					validate: false,
					attachments: nextAttachments,
					quiet: true,
					targetDraftId: draftId,
				});
			setSaveMessage(
				translate(
					text({ en: "Attachment removed.", hi: "संलग्नक हटा दिया गया।" }),
				),
			);
		} catch {
			setSaveError(true);
			setSaveMessage(
				translate(
					text({
						en: "The attachment could not be removed. Try again.",
						hi: "संलग्नक हटाया नहीं जा सका। फिर से कोशिश करें।",
					}),
				),
			);
		} finally {
			setAttachmentUpload(null);
		}
	};
	const clearForm = async () => {
		if (attachmentUpload || saving || submitting) return;
		const items = Object.values(state.attachments).flat();
		if (items.length > 0) {
			const { removeAttachment } = await import(
				"#/features/attachments/functions"
			);
			for (const item of items)
				await removeAttachment({
					data: { attachmentId: item.id },
				}).catch(() => undefined);
		}
		state.reset();
	};
	const submit = async () => {
		if (submitting || !state.validate()) return;
		setSubmitting(true);
		setSaveMessage(null);
		setSaveError(false);
		try {
			const saved = await save();
			if (!saved?.ok) return;
			if (!submissionKey.current)
				submissionKey.current = createIdempotencyKey();
			const result = await submitGrievance({
				data: {
					draftId: saved.draftId,
					reviewHash: saved.reviewHash,
					idempotencyKey: submissionKey.current,
				},
			});
			await navigate({
				to: "/grievances/$registrationId",
				params: { registrationId: result.registrationId },
			});
		} catch (error) {
			setSaveError(true);
			setSaveMessage(translate(submissionErrorText(error)));
		} finally {
			setSubmitting(false);
		}
	};
	if (restoring) return <LoadingMessage />;
	if (review)
		return (
			<ReviewPanel
				form={form}
				authorityName={authorityName}
				language={language}
				state={state}
				onEdit={goEdit}
				onSave={() => void save()}
				onSubmit={() => void submit()}
				saveMessage={saveMessage}
				saveError={saveError}
				saving={saving}
				submitting={submitting}
			/>
		);
	return (
		<form onSubmit={goReview} noValidate>
			{categoryControls}
			<div className="grid gap-6">
				{form.fields.map((field) => (
					<FieldControl
						field={field}
						key={field.id}
						values={state.values}
						attachments={state.attachments}
						errors={state.errors}
						onValue={state.setValue}
						uploadState={attachmentUpload}
						onAttachment={(file) => void uploadAttachment(field.id, file)}
						onRemoveAttachment={(item) =>
							void removeReadyAttachment(field.id, item)
						}
					/>
				))}
			</div>
			<div className="mt-8 flex flex-wrap gap-3">
				<button
					className="action-primary disabled:opacity-50"
					type="submit"
					disabled={attachmentUpload !== null}
				>
					{translate(text({ en: "Review details", hi: "विवरण देखें" }))}
				</button>
				<button
					className="action-secondary disabled:pointer-events-none disabled:opacity-50"
					type="button"
					onClick={() => void save()}
					disabled={saving || attachmentUpload !== null}
				>
					{translate(
						saving
							? text({ en: "Saving…", hi: "सहेजा जा रहा है…" })
							: text({ en: "Save draft", hi: "ड्राफ़्ट सहेजें" }),
					)}
				</button>
				<button
					className="min-h-11 px-5 py-2.5 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-blue-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					type="button"
					onClick={() => void clearForm()}
					disabled={attachmentUpload !== null}
				>
					{translate(text({ en: "Clear form", hi: "फ़ॉर्म साफ़ करें" }))}
				</button>
			</div>
			{saveMessage ? (
				<output
					className={`mt-4 block text-sm font-semibold ${
						saveError ? "text-red-700" : "text-emerald-800"
					}`}
					role={saveError ? "alert" : undefined}
				>
					{saveMessage}
				</output>
			) : null}
		</form>
	);
}

function FieldControl({
	field,
	values,
	attachments,
	errors,
	onValue,
	uploadState,
	onAttachment,
	onRemoveAttachment,
}: {
	field: CatalogueField;
	values: FormValues;
	attachments: AttachmentState;
	errors: FormErrors;
	onValue: (id: string, value: string) => void;
	uploadState: AttachmentUploadState;
	onAttachment: (file: File) => void;
	onRemoveAttachment: (item: ReadyAttachment) => void;
}) {
	const { text: translate } = useI18n();
	const label = translate(text({ en: field.label, hi: field.label }));
	const error = errors[field.id];
	const describedBy = error ? `${field.id}-error` : undefined;
	const attachmentHelpId = `${field.id}-attachment-help`;
	const currentAttachment = attachments[field.id]?.[0];
	const uploadingThisField = uploadState?.fieldId === field.id;
	const common = {
		id: field.id,
		name: field.id,
		"aria-invalid": Boolean(error),
		"aria-describedby": describedBy,
		required: field.required,
	};
	return (
		<div className="pb-6">
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
					className="field-control mt-2"
				>
					<option value="">
						{translate(text({ en: "Select an option", hi: "एक विकल्प चुनें" }))}
					</option>
					{(field.options ?? []).map((option) => (
						<option key={option} value={option}>
							{translate(text({ en: option, hi: option }))}
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
							? translate(
									text({ en: field.placeholder, hi: field.placeholder }),
								)
							: undefined
					}
					className="field-control mt-2 min-h-36 resize-y py-3"
				/>
			) : field.kind === "file" ? (
				<>
					<input
						{...common}
						type="file"
						accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
						disabled={uploadState !== null}
						aria-describedby={
							describedBy
								? `${describedBy} ${attachmentHelpId}`
								: attachmentHelpId
						}
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							if (file) onAttachment(file);
							event.currentTarget.value = "";
						}}
						className="mt-2 block min-h-12 w-full border border-dashed border-blue-300 bg-blue-50 p-3 text-sm text-blue-950 file:mr-4 file:border-0 file:bg-blue-800 file:px-3 file:py-2 file:font-semibold file:text-white disabled:cursor-wait disabled:opacity-60"
					/>
					<p
						id={attachmentHelpId}
						className="mt-2 text-sm leading-6 text-slate-600"
					>
						{translate(
							text({
								en: "Demo only. Upload one synthetic PDF, JPEG, or PNG file with no real personal data, up to 5 MB. The prototype checks the file type and checksum. Production also requires malware scanning.",
								hi: "केवल डेमो के लिए। वास्तविक व्यक्तिगत डेटा के बिना एक कृत्रिम PDF, JPEG या PNG फ़ाइल अपलोड करें, अधिकतम 5 MB। प्रोटोटाइप फ़ाइल प्रकार और चेकसम जाँचता है। उत्पादन में मैलवेयर स्कैनिंग भी आवश्यक है।",
							}),
						)}
					</p>
					{uploadingThisField ? (
						<output className="mt-2 block text-sm font-semibold text-blue-800">
							{translate(
								text({
									en: `Uploading and checking... ${uploadState.progress}%`,
									hi: `अपलोड और जाँच जारी है... ${uploadState.progress}%`,
								}),
							)}
						</output>
					) : null}
					{currentAttachment ? (
						<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-blue-200 py-3">
							<p className="min-w-0 text-sm text-blue-950">
								<span className="block truncate font-semibold">
									{currentAttachment.name}
								</span>
								<span className="text-slate-600">
									{currentAttachment.mimeType} ·{" "}
									{formatFileSize(currentAttachment.sizeBytes)}
								</span>
							</p>
							<button
								className="min-h-10 text-sm font-semibold text-red-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
								type="button"
								disabled={uploadState !== null}
								onClick={() => onRemoveAttachment(currentAttachment)}
							>
								{translate(text({ en: "Remove", hi: "हटाएँ" }))}
							</button>
						</div>
					) : null}
				</>
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
							? translate(
									text({ en: field.placeholder, hi: field.placeholder }),
								)
							: undefined
					}
					className="field-control mt-2"
				/>
			)}
			{field.maximumLength ? (
				<p className="mt-2 text-xs text-slate-600">
					{translate(
						text({
							en: `Up to ${field.maximumLength} characters.`,
							hi: `${field.maximumLength} अक्षरों तक।`,
						}),
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
	authorityName,
	language,
	state,
	onEdit,
	onSave,
	onSubmit,
	saveMessage,
	saveError,
	saving,
	submitting,
}: {
	form: CatalogueForm;
	authorityName: string;
	language: "en" | "hi";
	state: ReturnType<typeof useCatalogueFormState>;
	onEdit: () => void;
	onSave: () => void;
	onSubmit: () => void;
	saveMessage: string | null;
	saveError: boolean;
	saving: boolean;
	submitting: boolean;
}) {
	const { text: translate } = useI18n();
	const reviewAttachments = Object.values(state.attachments).flat();
	const remarks = state.values.remarks?.trim();
	return (
		<div className="w-full">
			<p className="page-eyebrow">
				{translate(text({ en: "Final review", hi: "अंतिम समीक्षा" }))}
			</p>
			<h1 className="page-title">
				{translate(text({ en: "Check your details", hi: "अपने विवरण जाँचें" }))}
			</h1>
			<p className="page-intro">
				{translate(
					text({
						en: "Review every detail before you submit this grievance.",
						hi: "इस मसौदे को सहेजने से पहले विवरण जाँचें।",
					}),
				)}
			</p>
			<dl className="mt-8 border-y border-blue-200">
				<ReviewDetail
					label={translate(text({ en: "Authority", hi: "प्राधिकरण" }))}
					value={authorityName}
				/>
				<ReviewDetail
					label={translate(text({ en: "Category", hi: "श्रेणी" }))}
					value={form.categoryPath.join(" › ")}
				/>
				<ReviewDetail
					label={translate(text({ en: "Form", hi: "फ़ॉर्म" }))}
					value={`${form.title} · ${translate(text({ en: "Version", hi: "संस्करण" }))} ${form.version}`}
				/>
				{form.fields.map((field) => (
					<div
						className="grid gap-1 border-b border-blue-200 py-4 last:border-b-0 sm:grid-cols-[minmax(10rem,0.45fr)_1fr]"
						key={field.id}
					>
						<dt className="text-sm font-semibold text-slate-600">
							{translate(text({ en: field.label, hi: field.label }))}
						</dt>
						<dd className="whitespace-pre-wrap break-words">
							{fieldHasValue(field, state.values, state.attachments)
								? field.kind === "file"
									? state.attachments[field.id]
											?.map((item) => item.name)
											.join(", ")
									: state.values[field.id]
								: translate(text({ en: "Not provided", hi: "नहीं दिया गया" }))}
						</dd>
					</div>
				))}
				<ReviewDetail
					label={translate(
						text({ en: "Final grievance remarks", hi: "अंतिम शिकायत टिप्पणी" }),
					)}
					value={
						remarks ||
						translate(text({ en: "Not provided", hi: "नहीं दिया गया" }))
					}
				/>
				<ReviewDetail
					label={translate(text({ en: "Attachments", hi: "संलग्नक" }))}
					value={
						reviewAttachments.length
							? reviewAttachments
									.map(
										(item) =>
											`${item.name} · ${item.mimeType} · ${formatFileSize(item.sizeBytes)}`,
									)
									.join(", ")
							: translate(
									text({ en: "No files attached", hi: "कोई फ़ाइल संलग्न नहीं है" }),
								)
					}
				/>
				<ReviewDetail
					label={translate(text({ en: "Language", hi: "भाषा" }))}
					value={
						language === "hi"
							? translate(text({ en: "Hindi", hi: "हिंदी" }))
							: translate(text({ en: "English", hi: "अंग्रेज़ी" }))
					}
				/>
				<ReviewDetail
					label={translate(
						text({ en: "Public sharing", hi: "सार्वजनिक साझाकरण" }),
					)}
					value={translate(text({ en: "Not selected", hi: "चुना नहीं गया" }))}
				/>
				<ReviewDetail
					label={translate(
						text({ en: "Redacted preview", hi: "संपादित पूर्वावलोकन" }),
					)}
					value={translate(
						text({
							en: "Not available until sharing is selected",
							hi: "साझाकरण चुने जाने तक उपलब्ध नहीं है",
						}),
					)}
				/>
				<ReviewDetail
					label={translate(text({ en: "AI confidence", hi: "AI विश्वास स्तर" }))}
					value={translate(text({ en: "Not provided", hi: "नहीं दिया गया" }))}
				/>
			</dl>
			<div className="mt-8 flex flex-wrap gap-3">
				<button
					className="action-secondary"
					type="button"
					onClick={onEdit}
					disabled={saving || submitting}
				>
					{translate(text({ en: "Edit details", hi: "विवरण बदलें" }))}
				</button>
				<button
					className="action-secondary"
					type="button"
					onClick={onSave}
					disabled={saving || submitting}
				>
					{translate(
						saving
							? text({ en: "Saving…", hi: "सहेजा जा रहा है…" })
							: text({ en: "Save draft", hi: "ड्राफ़्ट सहेजें" }),
					)}
				</button>
				<button
					className="action-primary"
					type="button"
					onClick={onSubmit}
					disabled={saving || submitting}
				>
					{translate(
						submitting
							? text({
									en: "Submitting grievance...",
									hi: "शिकायत जमा की जा रही है...",
								})
							: text({ en: "Submit grievance", hi: "शिकायत जमा करें" }),
					)}
				</button>
				<Link
					className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-800 no-underline underline-offset-4 hover:text-blue-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
					to="/services"
					search={{ q: "" }}
				>
					{translate(text({ en: "Change route", hi: "मार्ग बदलें" }))}
				</Link>
			</div>
			{saveMessage ? (
				<output
					className={`mt-4 block text-sm font-semibold ${
						saveError ? "text-red-700" : "text-emerald-800"
					}`}
					role={saveError ? "alert" : undefined}
				>
					{saveMessage}
				</output>
			) : null}
		</div>
	);
}

function ReviewDetail({
	label,
	value,
}: {
	label: string;
	value: string | undefined;
}) {
	return (
		<div className="grid gap-1 border-b border-blue-200 py-4 last:border-b-0 sm:grid-cols-[minmax(10rem,0.45fr)_1fr]">
			<dt className="text-sm font-semibold text-slate-600">{label}</dt>
			<dd className="whitespace-pre-wrap break-words">{value}</dd>
		</div>
	);
}

function formatFileSize(bytes: number) {
	return bytes >= 1024 * 1024
		? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
		: `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function LoadingMessage({ page = false }: { page?: boolean }) {
	const { text: translate } = useI18n();
	return (
		<output
			className={
				page
					? "page-shell block text-sm font-medium text-slate-700"
					: "block w-full py-6 text-sm font-medium text-slate-700"
			}
		>
			{translate(
				text({
					en: "Loading grievance categories…",
					hi: "शिकायत श्रेणियाँ लोड हो रही हैं…",
				}),
			)}
		</output>
	);
}
