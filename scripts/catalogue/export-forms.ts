import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { AuthorityChunk } from "../../src/features/catalogue/schema.ts";
import { runtimeAuthority } from "./runtime-forms.ts";

type ExportOptions = {
	catalogueDir?: string;
	outputPath?: string;
	splitDir?: string;
};

const root = resolve(import.meta.dirname, "../..");
const defaultCatalogueDir = resolve(root, "public/catalogue/authorities");
const defaultOutputPath = resolve(root, "public/forms.json");
const defaultSplitDir = resolve(root, "public/forms/authorities");

function encodedJson(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value)}\n`);
}

function checksum(value: Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}

function parseCli(argv: string[]): ExportOptions {
	const result: ExportOptions = {};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--catalogue" && argv[index + 1]) result.catalogueDir = argv[++index];
		else if (argument === "--output" && argv[index + 1]) result.outputPath = argv[++index];
		else if (argument === "--split" && argv[index + 1]) result.splitDir = argv[++index];
	}
	return result;
}

async function readChunks(catalogueDir: string): Promise<AuthorityChunk[]> {
	const files = (await readdir(catalogueDir, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
		.sort((left, right) => left.name.localeCompare(right.name));
	if (files.length === 0) throw new Error(`No authority catalogue files found in ${catalogueDir}`);
	return Promise.all(files.map(async (entry) => JSON.parse(
		await readFile(join(catalogueDir, entry.name), "utf8"),
	) as AuthorityChunk));
}

async function main(options: ExportOptions = {}): Promise<void> {
	const catalogueDir = resolve(options.catalogueDir ?? defaultCatalogueDir);
	const outputPath = resolve(options.outputPath ?? defaultOutputPath);
	const splitDir = resolve(options.splitDir ?? defaultSplitDir);
	const authorities = (await readChunks(catalogueDir)).map(runtimeAuthority);
	const formCount = authorities.reduce((count, authority) => count + authority.forms.length, 0);

	await Promise.all([mkdir(dirname(outputPath), { recursive: true }), mkdir(splitDir, { recursive: true })]);
	const authorityIndex = [];
	for (const authority of authorities) {
		const { forms, ...identity } = authority;
		const asset = `authorities/${authority.slug}.json`;
		const content = encodedJson({ schemaVersion: 1, authority: identity, formCount: forms.length, forms });
		await writeFile(join(splitDir, `${authority.slug}.json`), content);
		authorityIndex.push({ ...identity, formCount: forms.length, asset, checksum: checksum(content) });
	}

	await writeFile(outputPath, encodedJson({ schemaVersion: 1, formCount, authorities }));
	await writeFile(resolve(splitDir, "../index.json"), encodedJson({ schemaVersion: 1, formCount, authorities: authorityIndex }));
	console.log(`Wrote ${formCount} compact forms to ${outputPath} and ${authorities.length} authority files to ${splitDir}`);
}

await main(parseCli(process.argv.slice(2)));

