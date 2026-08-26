import {
	create,
	insertMultiple,
	load,
	type RawData,
	search,
} from "@orama/orama";

import type {
	AuthorityChunk,
	SearchDocument,
	SearchIndexArtifact,
} from "./schema";

export const SEARCH_SCHEMA_VERSION = 3 as const;
export const ORAMA_VERSION = "3.1.18" as const;
export const DEFAULT_SEARCH_PAGE_SIZE = 20;
export const MAX_SEARCH_PAGE_SIZE = 20;

const devanagariDigits: Record<string, string> = {
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

const stopWords = new Set([
	"a",
	"about",
	"an",
	"and",
	"are",
	"can",
	"complaint",
	"file",
	"find",
	"for",
	"form",
	"from",
	"grievance",
	"has",
	"have",
	"i",
	"if",
	"in",
	"card",
	"is",
	"issue",
	"issues",
	"it",
	"me",
	"my",
	"of",
	"on",
	"open",
	"our",
	"please",
	"problem",
	"the",
	"to",
	"under",
	"was",
	"we",
	"were",
	"with",
	"work",
	"working",
	"hai",
	"hain",
	"ka",
	"kaa",
	"ki",
	"ke",
	"ko",
	"mein",
	"mera",
	"mere",
	"meri",
	"mujhe",
	"nahi",
	"se",
	"ye",
	"यह",
	"और",
	"का",
	"काम",
	"की",
	"के",
	"को",
	"है",
	"हैं",
	"मेरा",
	"मेरे",
	"मेरी",
	"मुझे",
	"में",
	"नहीं",
	"से",
]);

const aliasGroups = [
	["aadhaar", "आधार", "adhar", "uidai"],
	["bank", "banking", "बैंक", "khata", "खाता"],
	["electricity", "power", "bijli", "बिजली"],
	["gas", "lpg", "गैस", "cylinder", "सिलेंडर"],
	["internet", "broadband", "data", "इंटरनेट", "net"],
	["mobile", "phone", "telecom", "मोबाइल", "फोन"],
	["water", "pani", "पानी", "jal", "जल"],
	["passport", "पासपोर्ट", "yatra", "यात्रा"],
	["pension", "पेंशन", "retirement", "सेवानिवृत्ति"],
	["rail", "railway", "train", "रेल", "रेलवे", "gaadi", "गाड़ी"],
	["refund", "वापसी", "wapasi", "money back", "पैसे वापस"],
	["delay", "late", "pending", "देर", "vilamb", "विलंब"],
	["fraud", "scam", "धोखा", "dhokha", "जालसाजी"],
] as const;

function createAliasLookup(
	groups: readonly (readonly string[])[],
): Record<string, string[]> {
	const lookup: Record<string, string[]> = {};
	for (const group of groups) {
		for (const term of group) {
			if (lookup[term]) throw new Error(`Search alias appears twice: ${term}`);
			lookup[term] = group.filter((candidate) => candidate !== term);
		}
	}
	return lookup;
}

const aliases = createAliasLookup(aliasGroups);

const oramaSchema = {
	id: "string",
	authorityId: "enum",
	authoritySlug: "enum",
	authorityName: "string",
	categoryId: "enum",
	rootCategoryId: "enum",
	title: "string",
	categoryPath: "string[]",
	aliases: "string",
	keywords: "string",
	phrases: "string",
	fieldLabels: "string",
	optionLabels: "string",
} as const;

export type CatalogueSearchEngine = ReturnType<
	typeof create<typeof oramaSchema>
>;

export type CatalogueSearchFilters = {
	authoritySlugs?: string[];
	categoryIds?: string[];
};

export type CatalogueSearchRequest = CatalogueSearchFilters & {
	query: string;
	page?: number;
	pageSize?: number;
};

export type CatalogueSearchHit = SearchDocument & { score: number };

export type CatalogueSearchResponse = {
	normalizedQuery: string;
	indexVersion: string;
	results: CatalogueSearchHit[];
	total: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
	facets: {
		authorities: Record<string, number>;
		categories: Record<string, number>;
	};
};

export function normalizeSearchText(value: string): string {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[०-९]/g, (digit) => devanagariDigits[digit] ?? digit)
		.replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

export function meaningfulSearchTokens(value: string): string[] {
	return unique(
		normalizeSearchText(value)
			.split(" ")
			.filter((token) => token.length > 1 && !stopWords.has(token)),
	);
}

export function expandSearchQuery(value: string): string {
	const tokens = meaningfulSearchTokens(value);
	return unique(
		tokens.flatMap((token) => [token, ...(aliases[token] ?? [])]),
	).join(" ");
}

function inferredTerms(values: string[]): string {
	const tokens = meaningfulSearchTokens(values.join(" "));
	return unique(tokens.flatMap((token) => aliases[token] ?? [])).join(" ");
}

export function buildSearchDocuments(
	chunks: AuthorityChunk[],
): SearchDocument[] {
	const documents: SearchDocument[] = [];
	for (const chunk of [...chunks].sort((a, b) =>
		a.authority.slug.localeCompare(b.authority.slug),
	)) {
		const categoryById = new Map(
			chunk.categories.map((category) => [category.id, category]),
		);
		for (const form of chunk.forms.filter((candidate) => candidate.active)) {
			const category = categoryById.get(form.categoryId);
			let root = category;
			while (root?.parentId && categoryById.has(root.parentId))
				root = categoryById.get(root.parentId);
			const fieldLabels = form.fields.map((field) => field.label);
			const optionLabels = form.fields.flatMap((field) => field.options ?? []);
			documents.push({
				id: form.id,
				authorityId: chunk.authority.id,
				authoritySlug: chunk.authority.slug,
				authorityName: chunk.authority.name,
				categoryId: form.categoryId,
				rootCategoryId: root?.id ?? form.categoryId,
				title: form.title,
				categoryPath: form.categoryPath,
				aliases: inferredTerms([
					form.title,
					...form.categoryPath,
					...fieldLabels,
					...optionLabels,
				]),
				keywords: `${form.heading ?? ""} ${form.pathname}`,
				phrases: `file complaint about ${form.categoryPath.join(" ")}`,
				fieldLabels: fieldLabels.join(" "),
				optionLabels: optionLabels.join(" "),
			});
		}
	}
	return documents.sort((a, b) => a.id.localeCompare(b.id));
}

type OramaIndexDocument = Omit<
	SearchDocument,
	"categoryId" | "rootCategoryId"
> & {
	categoryId: string;
	rootCategoryId: string;
};

function indexDocument(document: SearchDocument): OramaIndexDocument {
	return {
		...document,
		categoryId: document.categoryId ?? "",
		rootCategoryId: document.rootCategoryId ?? "",
		title: normalizeSearchText(document.title),
		authorityName: normalizeSearchText(document.authorityName),
		categoryPath: document.categoryPath.map(normalizeSearchText),
		aliases: normalizeSearchText(document.aliases),
		keywords: normalizeSearchText(document.keywords),
		phrases: normalizeSearchText(document.phrases),
		fieldLabels: normalizeSearchText(document.fieldLabels),
		optionLabels: normalizeSearchText(document.optionLabels),
	};
}

export async function createSearchEngine(
	documents: SearchDocument[],
): Promise<CatalogueSearchEngine> {
	const engine = create({ schema: oramaSchema, language: "english" });
	await insertMultiple(engine, documents.map(indexDocument), 250);
	return engine;
}

export function restoreSearchEngine(raw: RawData): CatalogueSearchEngine {
	const engine = create({ schema: oramaSchema, language: "english" });
	load(engine, raw);
	return engine;
}

function documentMatchesFilters(
	document: SearchDocument,
	filters: CatalogueSearchFilters,
): boolean {
	if (
		filters.authoritySlugs?.length &&
		!filters.authoritySlugs.includes(document.authoritySlug)
	)
		return false;
	if (
		filters.categoryIds?.length &&
		!filters.categoryIds.some(
			(id) => document.categoryId === id || document.rootCategoryId === id,
		)
	)
		return false;
	return true;
}

function phraseBonus(document: SearchDocument, normalized: string): number {
	if (!normalized) return 0;
	const title = normalizeSearchText(document.title);
	const path = normalizeSearchText(document.categoryPath.join(" "));
	const authority = normalizeSearchText(document.authorityName);
	if (title === normalized) return 10_000;
	if (authority === normalized) return 8_000;
	if (title.startsWith(normalized)) return 5_000;
	if (authority.startsWith(normalized)) return 3_500;
	if (title.includes(normalized)) return 2_000;
	if (authority.includes(normalized)) return 1_500;
	if (path.includes(normalized)) return 1_000;
	return 0;
}

export async function runCatalogueSearch(
	engine: CatalogueSearchEngine,
	documentCount: number,
	request: CatalogueSearchRequest,
	indexVersion: string,
): Promise<CatalogueSearchResponse> {
	const normalizedQuery = normalizeSearchText(request.query);
	const expandedQuery = expandSearchQuery(request.query);
	const page = Math.max(1, Math.trunc(request.page ?? 1));
	const pageSize = Math.min(
		MAX_SEARCH_PAGE_SIZE,
		Math.max(1, Math.trunc(request.pageSize ?? DEFAULT_SEARCH_PAGE_SIZE)),
	);
	if (!expandedQuery) {
		return {
			normalizedQuery,
			indexVersion,
			results: [],
			total: 0,
			page,
			pageSize,
			hasMore: false,
			facets: { authorities: {}, categories: {} },
		};
	}
	const queryTokens = meaningfulSearchTokens(normalizedQuery).slice(0, 8);
	const groups = queryTokens.map((token) => {
		const alternatives = unique([token, ...(aliases[token] ?? [])]);
		if (
			!/^[a-z0-9]+$/i.test(token) &&
			alternatives.some((item) => /^[a-z0-9 ]+$/i.test(item))
		) {
			return alternatives.filter((item) => /^[a-z0-9 ]+$/i.test(item));
		}
		return alternatives;
	});
	const matches = new Map<
		string,
		{ document: SearchDocument; scores: Map<number, number> }
	>();
	await Promise.all(
		groups.flatMap((alternatives, groupIndex) =>
			alternatives.map(async (alternative) => {
				const rawResults = await search(engine, {
					term: alternative,
					properties: [
						"title",
						"aliases",
						"categoryPath",
						"keywords",
						"authorityName",
						"phrases",
						"fieldLabels",
						"optionLabels",
					],
					boost: {
						title: 10,
						aliases: 8,
						categoryPath: 6,
						keywords: 5,
						authorityName: 4,
						phrases: 3,
						fieldLabels: 2,
						optionLabels: 1,
					},
					tolerance: 0,
					threshold: 0,
					limit: Math.max(documentCount, 1),
				});
				for (const hit of rawResults.hits) {
					const indexed = hit.document as OramaIndexDocument;
					const document: SearchDocument = {
						...indexed,
						categoryId: indexed.categoryId || null,
						rootCategoryId: indexed.rootCategoryId || null,
					};
					const current = matches.get(document.id) ?? {
						document,
						scores: new Map<number, number>(),
					};
					current.scores.set(
						groupIndex,
						Math.max(current.scores.get(groupIndex) ?? 0, hit.score),
					);
					matches.set(document.id, current);
				}
			}),
		),
	);
	const requiredGroups = groups.length >= 4 ? groups.length - 1 : groups.length;
	let ranked = [...matches.values()]
		.flatMap(({ document, scores }) => {
			if (
				scores.size < requiredGroups ||
				!documentMatchesFilters(document, request)
			)
				return [];
			const lexicalScore = [...scores.values()].reduce(
				(total, score) => total + score,
				0,
			);
			return [
				{
					...document,
					score: lexicalScore + phraseBonus(document, normalizedQuery),
				},
			];
		})
		.sort(
			(a, b) =>
				b.score - a.score ||
				a.title.localeCompare(b.title) ||
				a.id.localeCompare(b.id),
		);
	if (
		!ranked.length &&
		queryTokens.every((token) => /^[a-z0-9]+$/i.test(token))
	) {
		const fuzzy = await search(engine, {
			term: queryTokens.join(" "),
			properties: [
				"title",
				"aliases",
				"categoryPath",
				"keywords",
				"authorityName",
				"phrases",
				"fieldLabels",
				"optionLabels",
			],
			boost: {
				title: 10,
				aliases: 8,
				categoryPath: 6,
				keywords: 5,
				authorityName: 4,
				phrases: 3,
				fieldLabels: 2,
				optionLabels: 1,
			},
			tolerance: 1,
			threshold: 0,
			limit: Math.max(documentCount, 1),
		});
		ranked = fuzzy.hits
			.flatMap((hit) => {
				const indexed = hit.document as OramaIndexDocument;
				const document: SearchDocument = {
					...indexed,
					categoryId: indexed.categoryId || null,
					rootCategoryId: indexed.rootCategoryId || null,
				};
				return documentMatchesFilters(document, request)
					? [
							{
								...document,
								score: hit.score + phraseBonus(document, normalizedQuery),
							},
						]
					: [];
			})
			.sort(
				(a, b) =>
					b.score - a.score ||
					a.title.localeCompare(b.title) ||
					a.id.localeCompare(b.id),
			);
	}
	const strongestScore = ranked[0]?.score ?? 0;
	if (strongestScore > 0)
		ranked = ranked.filter((result) => result.score >= strongestScore * 0.08);

	const facets: CatalogueSearchResponse["facets"] = {
		authorities: {},
		categories: {},
	};
	for (const result of ranked) {
		facets.authorities[result.authoritySlug] =
			(facets.authorities[result.authoritySlug] ?? 0) + 1;
		if (result.rootCategoryId)
			facets.categories[result.rootCategoryId] =
				(facets.categories[result.rootCategoryId] ?? 0) + 1;
	}
	const offset = (page - 1) * pageSize;
	return {
		normalizedQuery,
		indexVersion,
		results: ranked.slice(offset, offset + pageSize),
		total: ranked.length,
		page,
		pageSize,
		hasMore: offset + pageSize < ranked.length,
		facets,
	};
}

export function assertSearchArtifact(value: unknown): SearchIndexArtifact {
	if (!value || typeof value !== "object")
		throw new Error("The local search index is invalid.");
	const artifact = value as Partial<SearchIndexArtifact>;
	if (
		artifact.schemaVersion !== SEARCH_SCHEMA_VERSION ||
		artifact.oramaVersion !== ORAMA_VERSION ||
		artifact.asset !== "search-index.data.json" ||
		typeof artifact.assetChecksum !== "string"
	) {
		throw new Error("The local search index version is not supported.");
	}
	return artifact as SearchIndexArtifact;
}
