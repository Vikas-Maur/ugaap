import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "../..");
const filePath = resolve(root, process.argv[2] ?? "public/forms.json");

function formatBytes(bytes: number): string {
	const units = ["KB", "MB", "GB"] as const;
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(2)} ${units[unitIndex]}`;
}

const input = await readFile(filePath);
const gzip = gzipSync(input);
const brotli = brotliCompressSync(input, {
	params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
});

console.log(`File: ${relative(root, filePath)}`);
console.log(`Uncompressed: ${formatBytes(input.byteLength)}`);
console.log(`Gzip: ${formatBytes(gzip.byteLength)}`);
console.log(`Brotli: ${formatBytes(brotli.byteLength)}`);
