/// <reference lib="webworker" />

import {
	assertSearchArtifact,
	type CatalogueSearchRequest,
	restoreSearchEngine,
	runCatalogueSearch,
} from "./search-core";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const MANIFEST_URL = "/catalogue/search-index.json";
const CACHE_NAME = "ugaap-catalogue-search-v3";

let loaded: ReturnType<typeof loadEngine> | undefined;

async function cachedAsset(path: string, cacheKey = path): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(cacheKey);
	try {
		const response = await fetch(path, {
			cache: "no-cache",
			credentials: "omit",
		});
		if (!response.ok)
			throw new Error(`Search index returned ${response.status}.`);
		await cache.put(cacheKey, response.clone());
		return response;
	} catch (error) {
		if (cached) return cached;
		throw error;
	}
}

async function loadEngine() {
	const artifact = assertSearchArtifact(
		await (await cachedAsset(MANIFEST_URL)).json(),
	);
	const serialized = await (
		await cachedAsset(
			`/catalogue/${artifact.asset}`,
			`/catalogue/${artifact.asset}?version=${artifact.assetChecksum}`,
		)
	).text();
	const engine = restoreSearchEngine(JSON.parse(serialized));
	return { artifact, engine };
}

async function handleSearch(request: CatalogueSearchRequest) {
	loaded ??= loadEngine();
	const { artifact, engine } = await loaded;
	return runCatalogueSearch(
		engine,
		artifact.documentCount,
		request,
		artifact.catalogueChecksum,
	);
}

worker.addEventListener(
	"message",
	(event: MessageEvent<{ id: number; request: CatalogueSearchRequest }>) => {
		const { id, request } = event.data;
		handleSearch(request)
			.then((result) => worker.postMessage({ id, result }))
			.catch((error: unknown) => {
				loaded = undefined;
				worker.postMessage({
					id,
					error: error instanceof Error ? error.message : "Search failed.",
				});
			});
	},
);
