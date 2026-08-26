import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chat } from "@tanstack/ai";
import { geminiText } from "@tanstack/ai-gemini";
import { z } from "zod";

import { configuredTextModel, hasConfiguredTextModel } from "../../src/server/ai/model.ts";
import { buildSearchDocuments } from "../../src/features/catalogue/search-core.ts";
import { searchEnrichmentItemSchema, searchEnrichmentSchema, type SearchEnrichment } from "../../src/features/catalogue/search-enrichment.ts";
import type { AuthorityChunk, CatalogueManifest } from "../../src/features/catalogue/schema.ts";

const root = resolve(import.meta.dirname, "../..");
const catalogueDir = resolve(root, "public/catalogue");
const outputPath = resolve(catalogueDir, "search-enrichment.json");
const batchSchema = z.object({ items: z.array(searchEnrichmentItemSchema).max(25) }).strict();

async function generateBatch(documents: ReturnType<typeof buildSearchDocuments>) {
	const stream = chat({
		adapter: geminiText(configuredTextModel()),
		messages: [{
			role: "user",
			content: `Create search metadata for these Indian government grievance forms. Return every supplied id exactly once. Add concise English, Hindi (Devanagari), and Romanized-Hindi aliases; issue keywords; and natural phrases a citizen might type. Never rewrite or translate an official title. Do not invent a service outside the supplied record.\n\n${JSON.stringify(documents.map(({ id, title, authorityName, categoryPath }) => ({ id, title, authorityName, categoryPath })))}`,
		}],
		outputSchema: batchSchema,
		stream: true,
		modelOptions: { temperature: 0.15, maxOutputTokens: 8_000 },
	});
	for await (const chunk of stream) {
		if (chunk.type === "CUSTOM" && chunk.name === "structured-output.complete") {
			return batchSchema.parse(chunk.value.object).items;
		}
	}
	throw new Error("The model did not return search enrichment metadata.");
}

async function main() {
	if (!hasConfiguredTextModel()) throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running catalogue:enrich.");
	const manifest = JSON.parse(await readFile(resolve(catalogueDir, "manifest.json"), "utf8")) as CatalogueManifest;
	const authorityEntries = Object.entries(manifest.checksums.authorities).sort(([a], [b]) => a.localeCompare(b));
	const sourceChecksum = createHash("sha256").update(JSON.stringify(authorityEntries)).digest("hex");
	const chunks = await Promise.all(authorityEntries.map(async ([slug]) => JSON.parse(await readFile(resolve(catalogueDir, "authorities", `${slug}.json`), "utf8")) as AuthorityChunk));
	const documents = buildSearchDocuments(chunks);
	let existing: SearchEnrichment | undefined;
	try {
		existing = searchEnrichmentSchema.parse(JSON.parse(await readFile(outputPath, "utf8")));
	} catch {
		existing = undefined;
	}
	const completed = new Map(existing?.sourceChecksum === sourceChecksum ? existing.items.map((item) => [item.id, item]) : []);
	const pending = documents.filter((document) => !completed.has(document.id));
	for (let offset = 0; offset < pending.length; offset += 20) {
		const batch = pending.slice(offset, offset + 20);
		const generated = await generateBatch(batch);
		const expected = new Set(batch.map((item) => item.id));
		for (const item of generated) if (expected.has(item.id)) completed.set(item.id, item);
		const artifact: SearchEnrichment = { schemaVersion: 1, sourceChecksum, generatedAt: new Date().toISOString(), items: [...completed.values()].sort((a, b) => a.id.localeCompare(b.id)) };
		await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
		console.log(`Enriched ${Math.min(offset + batch.length, pending.length)} of ${pending.length} pending records.`);
	}
}

await main();
