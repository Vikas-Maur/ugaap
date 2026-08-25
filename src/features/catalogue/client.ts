import { sanitizeRedirectPath, savePendingIntent } from "#/features/intent";
import type { AttachmentState } from "./form-state";
import type {
	AuthorityChunk,
	CatalogueForm,
	CatalogueIndex,
	SearchEntry,
} from "./schema";

export type CatalogueAuthority = {
	id: string;
	name: string;
	slug: string;
	categoryCount: number;
	formCount: number;
};

export type CatalogueDirectory = {
	index: CatalogueIndex;
	authorities: CatalogueAuthority[];
};

export type CatalogueSearchResult = SearchEntry & {
	authorityName: string;
	authoritySlug: string;
	form?: CatalogueForm;
};

export const MIN_CATALOGUE_QUERY_LENGTH = 2;

export type CatalogueDraftPayload = {
	form: CatalogueForm;
	draftId?: string;
	values: Record<string, string>;
	attachments: AttachmentState;
	language?: "en" | "hi";
};

export type CatalogueDraftResult =
	| { ok: true; draftId: string; reviewHash: string }
	| { ok: false; requiresAuth: true };

export type CatalogueDraftAdapter = (
	payload: CatalogueDraftPayload,
) => Promise<CatalogueDraftResult>;

let draftAdapter: CatalogueDraftAdapter = async (payload) => {
	const [{ getCurrentSession }, { saveDraft }] = await Promise.all([
		import("#/features/auth/functions"),
		import("#/features/drafts/functions"),
	]);
	if (!(await getCurrentSession())) return { ok: false, requiresAuth: true };

	try {
		const answers = Object.fromEntries(
			payload.form.fields
				.filter((field) => field.kind !== "file")
				.map((field) => [field.id, payload.values[field.id] ?? ""]),
		);
		const result = await saveDraft({
			data: {
				formKey: payload.form.id,
				formVersion: payload.form.version,
				draftId: payload.draftId,
				language: payload.language ?? "en",
				answers,
				remarks: payload.values.remarks ?? "",
				attachmentMetadata: Object.values(payload.attachments).flatMap(
					(items) =>
						items.map((item) => ({
							attachmentId: item.id,
							fieldId: item.fieldId,
							name: item.name,
							mimeType: item.mimeType,
							sizeBytes: item.sizeBytes,
						})),
				),
			},
		});
		if (!result.draft.reviewHash) {
			throw new Error("The saved draft could not be prepared for review");
		}
		return {
			ok: true,
			draftId: result.draft.id,
			reviewHash: result.draft.reviewHash,
		};
	} catch (error) {
		if (error instanceof Error && /unauthorized/i.test(error.message)) {
			return { ok: false, requiresAuth: true };
		}
		throw error;
	}
};

export function configureCatalogueDraftAdapter(adapter: CatalogueDraftAdapter) {
	draftAdapter = adapter;
}

export function saveCatalogueDraft(payload: CatalogueDraftPayload) {
	return draftAdapter(payload);
}

export function preservePendingCatalogueIntent(payload: CatalogueDraftPayload) {
	if (typeof window === "undefined") return;
	const answers = Object.fromEntries(
		Object.entries(payload.values).filter(
			([key]) =>
				!/(?:token|secret|password|credential|authorization|cookie|session|api[-_]?key)/i.test(
					key,
				),
		),
	);
	savePendingIntent({
		version: 1,
		kind: "grievance",
		title: payload.form.title,
		summary: payload.values.remarks ?? "",
		formKey: payload.form.id,
		formVersion: payload.form.version,
		language: payload.language ?? "en",
		answers,
		returnTo: sanitizeReturnTarget(
			window.location.pathname + window.location.search,
		),
	});
}

export function sanitizeReturnTarget(target: string) {
	const safe = sanitizeRedirectPath(target);
	return safe === "/" && target !== "/" ? "/services" : safe;
}

const CATALOGUE_ROOT = "/catalogue";
let searchIndexPromise: Promise<SearchEntry[]> | undefined;
let preparedSearchIndexPromise: Promise<PreparedSearchEntry[]> | undefined;
const authorityCache = new Map<string, Promise<AuthorityChunk>>();

function assertBrowser() {
	if (typeof window === "undefined") {
		throw new Error("Catalogue assets load in the browser.");
	}
}

async function readJson<T>(path: string): Promise<T> {
	assertBrowser();
	const response = await fetch(path, { credentials: "omit" });
	if (!response.ok) {
		throw new Error(
			`Catalogue asset could not be loaded (${response.status}).`,
		);
	}
	return (await response.json()) as T;
}

function labelFromSlug(slug: string) {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export async function loadCatalogueDirectory(): Promise<CatalogueDirectory> {
	const index = await readJson<CatalogueIndex>(`${CATALOGUE_ROOT}/index.json`);
	return {
		index,
		authorities: index.authorities,
	};
}

export function loadAuthorityChunk(slug: string): Promise<AuthorityChunk> {
	if (!/^[a-z0-9-]+$/.test(slug)) {
		return Promise.reject(new Error("That authority link is not valid."));
	}
	const cached = authorityCache.get(slug);
	if (cached) return cached;
	const request = readJson<AuthorityChunk>(
		`${CATALOGUE_ROOT}/authorities/${encodeURIComponent(slug)}.json`,
	);
	authorityCache.set(slug, request);
	return request;
}

function loadSearchIndex(): Promise<SearchEntry[]> {
	if (!searchIndexPromise) {
		searchIndexPromise = readJson<SearchEntry[]>(
			`${CATALOGUE_ROOT}/search-index.json`,
		);
	}
	return searchIndexPromise;
}

type PreparedSearchEntry = {
	entry: SearchEntry;
	authorityName: string;
	authoritySlug: string;
	title: string;
	category: string;
	authority: string;
	terms: string;
	tokens: string[];
};

const searchAliases: Record<string, string[]> = {
	bijli: ["electricity", "power", "बिजली"],
	बिजली: ["electricity", "power", "bijli"],
	electricity: ["bijli", "power", "बिजली"],
	pension: ["पेंशन"],
	passport: ["पासपोर्ट"],
	railway: ["train", "रेल", "रेलवे"],
	रेल: ["railway", "train", "रेलवे"],
	रेलवे: ["railway", "train", "रेल"],
	train: ["railway", "रेल", "रेलवे"],
	water: ["pani", "पानी"],
	पानी: ["water", "pani"],
	pani: ["water", "पानी"],
};

const searchStopWords = new Set([
	"a",
	"about",
	"an",
	"and",
	"are",
	"complaint",
	"for",
	"from",
	"grievance",
	"has",
	"have",
	"i",
	"in",
	"is",
	"issue",
	"issues",
	"me",
	"my",
	"not",
	"of",
	"on",
	"our",
	"please",
	"problem",
	"the",
	"to",
	"was",
	"we",
	"were",
	"with",
	"work",
	"working",
	"यह",
	"और",
	"कर",
	"का",
	"काम",
	"की",
	"के",
	"को",
	"है",
	"हैं",
	"मेरी",
	"मेरा",
	"मेरे",
	"मुझे",
	"में",
	"नहीं",
	"रहा",
	"रही",
	"रहे",
	"से",
]);

function normalizeSearchText(value: string): string {
	const hindiDigits: Record<string, string> = {
		"०": "0",
		"१": "1",
		"२": "2",
		"३": "3",
		"४": "4",
		"५": "5",
		"६": "6",
		"७": "7",
		"८": "8",
		"९": "9",
	};
	return value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[०-९]/g, (digit) => hindiDigits[digit] ?? digit)
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function uniqueTokens(value: string): string[] {
	return [...new Set(value.split(" ").filter(Boolean))];
}

function loadPreparedSearchIndex(): Promise<PreparedSearchEntry[]> {
	if (!preparedSearchIndexPromise) {
		preparedSearchIndexPromise = Promise.all([
			loadSearchIndex(),
			loadCatalogueDirectory(),
		]).then(([entries, directory]) => {
			const authorityById = new Map(
				directory.authorities.map((authority) => [authority.id, authority]),
			);
			return entries.map((entry) => {
				const catalogueAuthority = authorityById.get(entry.authorityId);
				const authorityName =
					catalogueAuthority?.name ??
					labelFromSlug(entry.authorityId.replace(/^authority-/, ""));
				const authoritySlug =
					catalogueAuthority?.slug ??
					entry.authorityId.replace(/^authority-/, "");
				const title = normalizeSearchText(entry.title);
				const category = normalizeSearchText(entry.categoryPath.join(" "));
				const authority = normalizeSearchText(authorityName);
				const terms = normalizeSearchText(entry.terms);
				return {
					entry,
					authorityName,
					authoritySlug,
					title,
					category,
					authority,
					terms,
					tokens: uniqueTokens(`${title} ${category} ${authority}`),
				};
			});
		});
	}
	return preparedSearchIndexPromise;
}

function editDistanceWithin(
	left: string,
	right: string,
	maximum: number,
): boolean {
	if (Math.abs(left.length - right.length) > maximum) return false;
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	let previousPrevious: number[] | undefined;
	for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
		const current = [leftIndex];
		let rowMinimum = current[0] ?? leftIndex;
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
			const substitution =
				left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			let value = Math.min(
				(previous[rightIndex] ?? maximum + 1) + 1,
				(current[rightIndex - 1] ?? maximum + 1) + 1,
				(previous[rightIndex - 1] ?? maximum + 1) + substitution,
			);
			if (
				previousPrevious &&
				leftIndex > 1 &&
				rightIndex > 1 &&
				left[leftIndex - 1] === right[rightIndex - 2] &&
				left[leftIndex - 2] === right[rightIndex - 1]
			) {
				value = Math.min(
					value,
					(previousPrevious[rightIndex - 2] ?? maximum + 1) + 1,
				);
			}
			current.push(value);
			rowMinimum = Math.min(rowMinimum, value);
		}
		if (rowMinimum > maximum) return false;
		previousPrevious = previous;
		previous = current;
	}
	return (previous[right.length] ?? maximum + 1) <= maximum;
}

function fuzzyTokenScore(
	queryToken: string,
	candidateTokens: string[],
): number {
	if (candidateTokens.includes(queryToken)) return 28;
	if (
		candidateTokens.some(
			(candidate) =>
				candidate.length >= 3 &&
				queryToken.length >= 3 &&
				(candidate.startsWith(queryToken) || queryToken.startsWith(candidate)),
		)
	)
		return 20;
	const maximumEdits =
		queryToken.length >= 8 ? 2 : queryToken.length >= 4 ? 1 : 0;
	if (
		maximumEdits > 0 &&
		candidateTokens.some((candidate) =>
			editDistanceWithin(queryToken, candidate, maximumEdits),
		)
	)
		return 10;
	return 0;
}

function authorityMatchesQuery(
	authority: string,
	queryTokens: string[],
): boolean {
	const authorityTokens = uniqueTokens(authority);
	return queryTokens.every((queryToken) => {
		const alternatives = [queryToken, ...(searchAliases[queryToken] ?? [])].map(
			normalizeSearchText,
		);
		return alternatives.some(
			(alternative) =>
				alternative && fuzzyTokenScore(alternative, authorityTokens) > 0,
		);
	});
}

function scoreSearchEntry(
	item: PreparedSearchEntry,
	phrase: string,
	queryTokens: string[],
): number | null {
	let score = 0;
	let matchedTokens = 0;
	if (item.title === phrase) score += 180;
	else if (item.title.startsWith(phrase)) score += 130;
	else if (item.title.includes(phrase)) score += 95;
	if (item.category.includes(phrase)) score += 62;
	if (item.authority.includes(phrase)) score += 46;
	if (item.terms.includes(phrase)) score += 28;

	for (const [queryIndex, queryToken] of queryTokens.entries()) {
		const alternatives = [queryToken, ...(searchAliases[queryToken] ?? [])].map(
			normalizeSearchText,
		);
		let tokenScore = 0;
		for (const alternative of alternatives) {
			if (!alternative) continue;
			if (item.title.split(" ").includes(alternative))
				tokenScore = Math.max(tokenScore, 52);
			else if (
				item.title.split(" ").some((token) => token.startsWith(alternative))
			)
				tokenScore = Math.max(tokenScore, 40);
			if (item.category.split(" ").includes(alternative))
				tokenScore = Math.max(tokenScore, 34);
			if (item.authority.split(" ").includes(alternative))
				tokenScore = Math.max(tokenScore, 28);
			tokenScore = Math.max(
				tokenScore,
				fuzzyTokenScore(alternative, item.tokens),
			);
		}
		if (tokenScore === 0) continue;
		matchedTokens += 1;
		score += tokenScore + (queryIndex === 0 ? 25 : 0);
	}
	const requiredMatches = queryTokens.length <= 3 ? 1 : 2;
	if (matchedTokens < requiredMatches) return null;
	return score + Math.round((matchedTokens / queryTokens.length) * 40);
}

export async function searchCatalogue(
	query: string,
	options: { limit?: number } = {},
): Promise<CatalogueSearchResult[]> {
	const normalizedQuery = normalizeSearchText(query);
	if (normalizedQuery.length < MIN_CATALOGUE_QUERY_LENGTH) return [];

	const entries = await loadPreparedSearchIndex();
	const queryTokens = uniqueTokens(normalizedQuery).filter(
		(token) => !searchStopWords.has(token),
	);
	if (!queryTokens.length) return [];
	const matchedAuthoritySlugs = new Set(
		entries
			.filter((entry) => authorityMatchesQuery(entry.authority, queryTokens))
			.map((entry) => entry.authoritySlug),
	);
	const ranked = entries
		.map((item) => ({
			item,
			score: scoreSearchEntry(item, normalizedQuery, queryTokens),
		}))
		.filter(
			(match): match is { item: PreparedSearchEntry; score: number } =>
				match.score !== null,
		)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.item.authorityName.localeCompare(right.item.authorityName) ||
				left.item.entry.categoryPath
					.join("/")
					.localeCompare(right.item.entry.categoryPath.join("/")) ||
				left.item.entry.id.localeCompare(right.item.entry.id),
		);
	const topScore = ranked[0]?.score;
	const strongestTextMatches = ranked
		.filter((match) => topScore === undefined || match.score >= topScore - 35)
		.map((match) => match.item);
	const authorityExpansion = entries
		.filter((entry) => matchedAuthoritySlugs.has(entry.authoritySlug))
		.sort(
			(left, right) =>
				left.authorityName.localeCompare(right.authorityName) ||
				left.entry.categoryPath
					.join("/")
					.localeCompare(right.entry.categoryPath.join("/")) ||
				left.entry.title.localeCompare(right.entry.title),
		)
		.slice(0, Math.ceil((options.limit ?? 30) / 2));
	const ordered = new Map<string, PreparedSearchEntry>();
	for (const item of [
		...strongestTextMatches,
		...authorityExpansion,
		...ranked.map((match) => match.item),
	]) {
		if (!ordered.has(item.entry.id)) ordered.set(item.entry.id, item);
	}
	return [...ordered.values()].slice(0, options.limit ?? 30).map((item) => ({
		...item.entry,
		authorityName: item.authorityName,
		authoritySlug: item.authoritySlug,
	}));
}

export function findForm(chunk: AuthorityChunk, formId: string) {
	return chunk.forms.find((form) => form.id === formId && form.active);
}

export function findCategory(chunk: AuthorityChunk, categoryId: string) {
	return chunk.categories.find((category) => category.id === categoryId);
}
