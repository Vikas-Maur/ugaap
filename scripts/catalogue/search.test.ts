import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
	assertSearchArtifact,
	buildSearchDocuments,
	createSearchEngine,
	expandSearchQuery,
	normalizeSearchText,
	restoreSearchEngine,
	runCatalogueSearch,
} from "../../src/features/catalogue/search-core.ts";
import type { AuthorityChunk, CatalogueIndex } from "../../src/features/catalogue/schema.ts";

const catalogueDir = resolve(import.meta.dirname, "../../public/catalogue");

async function fixtures() {
	const directory = JSON.parse(await readFile(resolve(catalogueDir, "index.json"), "utf8")) as CatalogueIndex;
	const chunks = await Promise.all(directory.authorities.map(async (authority) => JSON.parse(await readFile(resolve(catalogueDir, "authorities", `${authority.slug}.json`), "utf8")) as AuthorityChunk));
	const artifact = assertSearchArtifact(JSON.parse(await readFile(resolve(catalogueDir, "search-index.json"), "utf8")));
	const bytes = await readFile(resolve(catalogueDir, artifact.asset));
	assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.assetChecksum);
	return { artifact, bytes, chunks, documents: buildSearchDocuments(chunks) };
}

test("normalization preserves mixed Indian-language text and identifiers", () => {
	assert.equal(normalizeSearchText("  मेरी ५G / PAN समस्या  "), "मेरी 5g pan समस्या");
});

test("concept aliases expand in every direction", () => {
	assert.equal(expandSearchQuery("धोखा"), "धोखा fraud scam dhokha जालसाजी");
	assert.equal(expandSearchQuery("जालसाजी"), "जालसाजी fraud scam धोखा dhokha");
	assert.equal(expandSearchQuery("वापसी"), "वापसी refund wapasi money back पैसे वापस");
});

test("persisted index has the same top results as a fresh index", async () => {
	const { artifact, bytes, documents } = await fixtures();
	const fresh = await createSearchEngine(documents);
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	for (const query of ["passport delay", "पेंशन", "5G data speed", "PAN card"]) {
		const request = { query, page: 1, pageSize: 10 } as const;
		const [freshResult, restoredResult] = await Promise.all([
			runCatalogueSearch(fresh, documents.length, request, artifact.catalogueChecksum),
			runCatalogueSearch(restored, artifact.documentCount, request, artifact.catalogueChecksum),
		]);
		assert.deepEqual(restoredResult.results.map((item) => item.id), freshResult.results.map((item) => item.id), query);
	}
});

test("Hindi aliases find fraud forms like English and Romanized queries", async () => {
	const { artifact, bytes } = await fixtures();
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	const queries = ["fraud", "dhokha", "धोखा", "जालसाजी"];
	const results = await Promise.all(
		queries.map((query) =>
			runCatalogueSearch(
				restored,
				artifact.documentCount,
				{ query, page: 1, pageSize: 10 },
				artifact.catalogueChecksum,
			),
		),
	);
	const englishResultIds = new Set(results[0].results.map((item) => item.id));
	for (const result of results) {
		assert.ok(result.total > 0);
		assert.ok(result.results.some((item) => englishResultIds.has(item.id)));
	}
});

test("the search index contains each active form once and no navigation records", async () => {
	const { chunks, documents } = await fixtures();
	const activeFormIds = chunks.flatMap((chunk) =>
		chunk.forms.filter((form) => form.active).map((form) => form.id),
	);
	const headings = new Map(
		chunks.flatMap((chunk) =>
			chunk.forms
				.filter((form) => form.active)
				.map((form) => [form.id, form.heading ?? ""] as const),
		),
	);
	assert.equal(documents.length, activeFormIds.length);
	assert.equal(new Set(documents.map((document) => document.id)).size, documents.length);
	assert.deepEqual(
		new Set(documents.map((document) => document.id)),
		new Set(activeFormIds),
	);
	assert.ok(documents.every((document) => !("kind" in document)));
	assert.ok(
		chunks.every((chunk) =>
			chunk.forms.every((form) => !("pathname" in form)),
		),
	);
	assert.ok(
		documents.every(
			(document) => document.keywords === headings.get(document.id),
		),
	);
});

test("PAN correction search returns one canonical form result", async () => {
	const { artifact, bytes } = await fixtures();
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	const result = await runCatalogueSearch(
		restored,
		artifact.documentCount,
		{ query: "pan card correct", page: 1, pageSize: 20 },
		artifact.catalogueChecksum,
	);
	const correctionForms = result.results.filter(
		(item) =>
			item.authoritySlug === "central-board-of-direct-taxes-income-tax" &&
			normalizeSearchText(item.title) === "correction in pan",
	);
	assert.equal(correctionForms.length, 1);
	assert.equal(new Set(result.results.map((item) => item.id)).size, result.results.length);
});

test("authority names search the forms that carry that metadata", async () => {
	const { artifact, bytes } = await fixtures();
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	const result = await runCatalogueSearch(
		restored,
		artifact.documentCount,
		{ query: "central board direct taxes income tax", page: 1, pageSize: 20 },
		artifact.catalogueChecksum,
	);
	assert.ok(result.results.length > 0);
	assert.ok(
		result.results.every(
			(item) =>
				item.authoritySlug === "central-board-of-direct-taxes-income-tax",
		),
	);
});

test("a partial authority name keeps its forms in the first result page", async () => {
	const { artifact, bytes } = await fixtures();
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	const result = await runCatalogueSearch(
		restored,
		artifact.documentCount,
		{ query: "central", page: 1, pageSize: 20 },
		artifact.catalogueChecksum,
	);
	assert.ok(
		result.results.some(
			(item) =>
				item.authoritySlug === "central-board-of-direct-taxes-income-tax",
		),
	);
});

test("filters and page metadata are applied by the shared engine", async () => {
	const { artifact, bytes, documents } = await fixtures();
	const restored = restoreSearchEngine(JSON.parse(bytes.toString("utf8")));
	const result = await runCatalogueSearch(restored, artifact.documentCount, {
		query: "pension",
		page: 1,
		pageSize: 5,
	}, artifact.catalogueChecksum);
	assert.ok(result.results.length > 0);
	assert.equal(artifact.documentCount, documents.length);
	assert.equal(result.pageSize, 5);
	assert.equal(result.hasMore, result.total > 5);
});
