/// <reference lib="webworker" />

import type { RawData } from "@orama/orama";

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

type SearchIndexData = {
	artifact: ReturnType<typeof assertSearchArtifact>;
	raw: RawData;
};

function assetCacheKey(artifact: SearchIndexData["artifact"]): string {
	return `/catalogue/${artifact.asset}?version=${artifact.assetChecksum}`;
}

async function fetchAsset(path: string): Promise<Response> {
	const response = await fetch(path, {
		cache: "no-cache",
		credentials: "omit",
	});
	if (!response.ok)
		throw new Error(`Search index returned ${response.status}.`);
	return response;
}

async function fetchAndCacheIndex(cache: Cache): Promise<SearchIndexData> {
	const manifestResponse = await fetchAsset(MANIFEST_URL);
	const artifact = assertSearchArtifact(await manifestResponse.clone().json());
	const assetResponse = await fetchAsset(`/catalogue/${artifact.asset}`);
	const serialized = await assetResponse.clone().text();
	const raw = JSON.parse(serialized) as RawData;

	// Store the versioned data before promoting the manifest that points to it.
	await cache.put(assetCacheKey(artifact), assetResponse);
	await cache.put(MANIFEST_URL, manifestResponse);
	return { artifact, raw };
}

async function readCachedIndex(
	cache: Cache,
): Promise<SearchIndexData | undefined> {
	const manifestResponse = await cache.match(MANIFEST_URL);
	if (!manifestResponse) return undefined;
	try {
		const artifact = assertSearchArtifact(await manifestResponse.json());
		const assetResponse = await cache.match(assetCacheKey(artifact));
		if (!assetResponse) return undefined;
		const serialized = await assetResponse.text();
		return { artifact, raw: JSON.parse(serialized) as RawData };
	} catch {
		return undefined;
	}
}

function restoreIndex({ artifact, raw }: SearchIndexData) {
	return {
		artifact,
		engine: restoreSearchEngine(raw),
	};
}

async function revalidateIndex(
	cache: Cache,
	currentArtifact: SearchIndexData["artifact"],
): Promise<void> {
	try {
		const refreshed = await fetchAndCacheIndex(cache);
		if (
			refreshed.artifact.assetChecksum !== currentArtifact.assetChecksum ||
			refreshed.artifact.catalogueChecksum !== currentArtifact.catalogueChecksum
		) {
			loaded = Promise.resolve(restoreIndex(refreshed));
		}
	} catch {
		// A cached index remains usable while offline or during a failed refresh.
	}
}

async function loadEngine() {
	const cache = await caches.open(CACHE_NAME);
	const cached = await readCachedIndex(cache);
	if (cached) {
		try {
			const restored = restoreIndex(cached);
			void revalidateIndex(cache, cached.artifact);
			return restored;
		} catch {
			// Ignore an invalid cache entry and replace it from the network.
		}
	}
	return restoreIndex(await fetchAndCacheIndex(cache));
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
