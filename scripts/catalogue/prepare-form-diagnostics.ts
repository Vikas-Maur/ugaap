import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { AuthorityChunk } from "../../src/features/catalogue/schema.ts";
import { runtimeAuthority } from "./runtime-forms.ts";

const root = resolve(import.meta.dirname, "../..");
const rawFormsPath = resolve(root, "public/forms.json");
const catalogueDirectory = resolve(root, "public/catalogue/authorities");
const outputDirectory = resolve(root, "public/form-diagnostics");
const splitDirectory = join(outputDirectory, "compact-authorities");

function encoded(value: unknown): string {
	return `${JSON.stringify(value)}\n`;
}

function stripCaptureData(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stripCaptureData);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key, item]) =>
				item !== null &&
				!["capturedAt", "differences", "sourcePath", "pathname"].includes(key),
			)
			.map(([key, item]) => [key, stripCaptureData(item)]),
	);
}

const rawArtifact = JSON.parse(await readFile(rawFormsPath, "utf8")) as {
	schemaVersion: number;
	formCount: number;
	forms: unknown[];
};
const authorityFiles = (await readdir(catalogueDirectory, { withFileTypes: true }))
	.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
	.sort((left, right) => left.name.localeCompare(right.name));
const authorities = await Promise.all(authorityFiles.map(async (entry) =>
	runtimeAuthority(JSON.parse(
		await readFile(join(catalogueDirectory, entry.name), "utf8"),
	) as AuthorityChunk),
));
const formCount = authorities.reduce((count, authority) => count + authority.forms.length, 0);

await mkdir(splitDirectory, { recursive: true });
await writeFile(join(outputDirectory, "cleaned-single.json"), encoded({
	schemaVersion: rawArtifact.schemaVersion,
	formCount: rawArtifact.formCount,
	forms: rawArtifact.forms.map(stripCaptureData),
}));
await writeFile(join(outputDirectory, "compact-single.json"), encoded({
	schemaVersion: 1,
	formCount,
	authorities,
}));

const indexAuthorities = [];
for (const authority of authorities) {
	const { forms, ...identity } = authority;
	const asset = `${authority.slug}.json`;
	await writeFile(join(splitDirectory, asset), encoded({
		schemaVersion: 1,
		authority: identity,
		formCount: forms.length,
		forms,
	}));
	indexAuthorities.push({ ...identity, formCount: forms.length, asset });
}
await writeFile(join(splitDirectory, "index.json"), encoded({
	schemaVersion: 1,
	formCount,
	authorities: indexAuthorities,
}));

console.log(`Prepared ${formCount} forms in one cleaned file, one compact file, and ${authorities.length} compact authority files.`);
