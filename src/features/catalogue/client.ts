import { sanitizeRedirectPath, savePendingIntent } from "#/features/intent";
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
};

export type CatalogueDirectory = {
	index: CatalogueIndex;
	authorities: CatalogueAuthority[];
};

export type CatalogueSearchResult = SearchEntry & {
	authorityName: string;
	form?: CatalogueForm;
};

export type CatalogueDraftPayload = {
	form: CatalogueForm;
	draftId?: string;
	values: Record<string, string>;
	attachments: Record<string, string[]>;
	language?: "en" | "hi";
};

export type CatalogueDraftResult =
	| { ok: true; draftId?: string }
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
		const result = await saveDraft({
			data: {
				formKey: payload.form.id,
				formVersion: payload.form.version,
				draftId: payload.draftId,
				language: payload.language ?? "en",
				answers: payload.values,
				remarks: payload.values.remarks ?? "",
				attachmentMetadata: Object.entries(payload.attachments).flatMap(
					([fieldId, names]) => names.map((name) => ({ fieldId, name })),
				),
			},
		});
		return { ok: true, draftId: result.draft.id };
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

export async function searchCatalogue(
	query: string,
	options: { limit?: number } = {},
): Promise<CatalogueSearchResult[]> {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (!normalizedQuery) return [];

	const [entries, directory] = await Promise.all([
		loadSearchIndex(),
		loadCatalogueDirectory(),
	]);
	const terms = normalizedQuery.split(/\s+/).filter(Boolean);
	const authorityById = new Map(
		directory.authorities.map((authority) => [authority.id, authority]),
	);
	const matches = entries
		.filter((entry) => terms.every((term) => entry.terms.includes(term)))
		.slice(0, options.limit ?? 30)
		.map((entry) => ({
			...entry,
			authorityName:
				authorityById.get(entry.authorityId)?.name ??
				labelFromSlug(entry.authorityId.replace(/^authority-/, "")),
		}));
	return matches;
}

export function findForm(chunk: AuthorityChunk, formId: string) {
	return chunk.forms.find((form) => form.id === formId && form.active);
}

export function findCategory(chunk: AuthorityChunk, categoryId: string) {
	return chunk.categories.find((category) => category.id === categoryId);
}
