import type { CatalogueIndex, SearchEntry } from "#/features/catalogue/schema";
import type { AssistantCandidate } from "./schema";

type PreparedEntry = AssistantCandidate & {
	searchText: string;
	tokens: string[];
};

const catalogueCache = new Map<string, Promise<PreparedEntry[]>>();

const aliases: Record<string, string[]> = {
	bijli: ["electricity", "power", "बिजली"],
	बिजली: ["electricity", "power", "bijli"],
	electricity: ["power", "bijli", "बिजली"],
	pension: ["पेंशन"],
	passport: ["पासपोर्ट"],
	pani: ["water", "पानी"],
	पानी: ["water", "pani"],
	rail: ["railway", "train", "रेल", "रेलवे"],
	रेल: ["railway", "train", "rail"],
	train: ["railway", "rail", "रेल"],
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
	"in",
	"if",
	"is",
	"it",
	"issue",
	"issues",
	"me",
	"my",
	"not",
	"of",
	"on",
	"open",
	"our",
	"please",
	"possible",
	"problem",
	"right",
	"so",
	"take",
	"the",
	"there",
	"to",
	"under",
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
	"से",
]);

function normalize(value: string) {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function uniqueTokens(value: string) {
	return [
		...new Set(
			normalize(value)
				.split(" ")
				.filter((token) => token.length > 1),
		),
	];
}

function editDistanceWithin(left: string, right: string, maximum: number) {
	if (Math.abs(left.length - right.length) > maximum) return false;
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
		const current = [leftIndex];
		let rowMinimum = leftIndex;
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
			const substitution =
				left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			const value = Math.min(
				(previous[rightIndex] ?? maximum + 1) + 1,
				(current[rightIndex - 1] ?? maximum + 1) + 1,
				(previous[rightIndex - 1] ?? maximum + 1) + substitution,
			);
			current.push(value);
			rowMinimum = Math.min(rowMinimum, value);
		}
		if (rowMinimum > maximum) return false;
		previous = current;
	}
	return (previous[right.length] ?? maximum + 1) <= maximum;
}

function score(entry: PreparedEntry, query: string) {
	const phrase = normalize(query);
	const tokens = uniqueTokens(query).filter((token) => !stopWords.has(token));
	if (!tokens.length) return null;
	let total = entry.searchText.includes(phrase) ? 120 : 0;
	let matchedTokens = 0;
	const titleTokens = uniqueTokens(entry.title);
	for (const [tokenIndex, token] of tokens.entries()) {
		const alternatives = [token, ...(aliases[token] ?? [])].map(normalize);
		if (
			alternatives.some((alternative) => entry.tokens.includes(alternative))
		) {
			total += alternatives.some((alternative) =>
				titleTokens.includes(alternative),
			)
				? 70
				: 45;
			if (tokenIndex === 0) total += 25;
			matchedTokens += 1;
			continue;
		}
		if (
			alternatives.some((alternative) =>
				entry.tokens.some(
					(candidate) =>
						candidate.length >= 4 &&
						alternative.length >= 4 &&
						(candidate.startsWith(alternative) ||
							alternative.startsWith(candidate)),
				),
			)
		) {
			total += 25;
			matchedTokens += 1;
			continue;
		}
		const edits = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
		if (
			edits &&
			alternatives.some((alternative) =>
				entry.tokens.some((candidate) =>
					editDistanceWithin(alternative, candidate, edits),
				),
			)
		) {
			total += 12;
			matchedTokens += 1;
		}
	}
	const requiredMatches = tokens.length <= 3 ? 1 : 2;
	if (matchedTokens < requiredMatches) return null;
	return total + Math.round((matchedTokens / tokens.length) * 40);
}

async function loadCatalogue(origin: string): Promise<PreparedEntry[]> {
	const cached = catalogueCache.get(origin);
	if (cached) return cached;
	const request = Promise.all([
		fetch(new URL("/catalogue/index.json", origin), {
			headers: { accept: "application/json" },
		}),
		fetch(new URL("/catalogue/search-index.json", origin), {
			headers: { accept: "application/json" },
		}),
	]).then(async ([directoryResponse, searchResponse]) => {
		if (!directoryResponse.ok || !searchResponse.ok) {
			throw new Error("The grievance catalogue is unavailable.");
		}
		const directory = (await directoryResponse.json()) as CatalogueIndex;
		const entries = (await searchResponse.json()) as SearchEntry[];
		const authorityById = new Map(
			directory.authorities.map((authority) => [authority.id, authority]),
		);
		return entries.flatMap((entry) => {
			const authority = authorityById.get(entry.authorityId);
			if (!authority) return [];
			const candidate: AssistantCandidate = {
				formId: entry.id,
				authoritySlug: authority.slug,
				authorityName: authority.name,
				title: entry.title,
				categoryPath: entry.categoryPath,
			};
			const searchText = normalize(
				`${entry.title} ${entry.categoryPath.join(" ")} ${authority.name}`,
			);
			return [{ ...candidate, searchText, tokens: uniqueTokens(searchText) }];
		});
	});
	catalogueCache.set(origin, request);
	request.catch(() => catalogueCache.delete(origin));
	return request;
}

export async function findAssistantCandidates(
	origin: string,
	query: string,
	limit = 12,
) {
	if (normalize(query).length < 2) return [];
	const entries = await loadCatalogue(origin);
	const ranked = entries
		.map((entry) => ({ entry, score: score(entry, query) }))
		.filter(
			(match): match is { entry: PreparedEntry; score: number } =>
				match.score !== null,
		)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.entry.title.localeCompare(right.entry.title),
		);
	const topScore = ranked[0]?.score;
	return ranked
		.filter((match) => topScore === undefined || match.score >= topScore - 35)
		.slice(0, limit)
		.map(({ entry }) => ({
			formId: entry.formId,
			authoritySlug: entry.authoritySlug,
			authorityName: entry.authorityName,
			title: entry.title,
			categoryPath: entry.categoryPath,
		}));
}
