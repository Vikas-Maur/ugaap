import { createHash } from "node:crypto";

import {
	assertSearchArtifact,
	type CatalogueSearchEngine,
	type CatalogueSearchRequest,
	type CatalogueSearchResponse,
	restoreSearchEngine,
	runCatalogueSearch,
} from "#/features/catalogue/search-core";
import type { AssistantCandidate } from "./schema";

type LoadedServerIndex = {
	engine: CatalogueSearchEngine;
	documentCount: number;
	version: string;
};

const catalogueCache = new Map<string, Promise<LoadedServerIndex>>();

async function loadServerIndex(origin: string): Promise<LoadedServerIndex> {
	const cached = catalogueCache.get(origin);
	if (cached) return cached;
	const request = (async () => {
		const manifestResponse = await fetch(
			new URL("/catalogue/search-index.json", origin),
			{
				headers: { accept: "application/json" },
			},
		);
		if (!manifestResponse.ok)
			throw new Error("The grievance search index is unavailable.");
		const artifact = assertSearchArtifact(await manifestResponse.json());
		const indexResponse = await fetch(
			new URL(`/catalogue/${artifact.asset}`, origin),
		);
		if (!indexResponse.ok)
			throw new Error("The grievance search index is unavailable.");
		const bytes = Buffer.from(await indexResponse.arrayBuffer());
		const actualChecksum = createHash("sha256").update(bytes).digest("hex");
		if (actualChecksum !== artifact.assetChecksum)
			throw new Error("The grievance search index checksum does not match.");
		const engine = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
		return {
			engine,
			documentCount: artifact.documentCount,
			version: artifact.catalogueChecksum,
		};
	})();
	catalogueCache.set(origin, request);
	request.catch(() => catalogueCache.delete(origin));
	return request;
}

export async function searchCatalogueServer(
	origin: string,
	request: CatalogueSearchRequest,
): Promise<CatalogueSearchResponse> {
	const loaded = await loadServerIndex(origin);
	return runCatalogueSearch(
		loaded.engine,
		loaded.documentCount,
		request,
		loaded.version,
	);
}

export async function findAssistantCandidates(
	origin: string,
	query: string,
	limit = 12,
): Promise<AssistantCandidate[]> {
	const response = await searchCatalogueServer(origin, {
		query,
		page: 1,
		pageSize: Math.min(limit, 20),
	});
	return response.results.map((result) => ({
		formId: result.id,
		authoritySlug: result.authoritySlug,
		authorityName: result.authorityName,
		title: result.title,
		categoryPath: result.categoryPath,
	}));
}
