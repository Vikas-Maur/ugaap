import { create, insertMultiple, search } from "@orama/orama";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/diagnostics/forms")({
	component: FormDiagnostics,
});

type Strategy = {
	id: string;
	label: string;
	url: string;
	concurrency: number;
	split: boolean;
};

type NetworkMetric = {
	url: string;
	status: number;
	contentEncoding: string | null;
	contentLength: string | null;
	vercelCache: string | null;
	downloadMs: number;
	transferSize: number;
	encodedBodySize: number;
	decodedBodySize: number;
};

type HeapSample = { stage: string; bytes: number | null };

type TestResult = {
	strategyId: string;
	label: string;
	startedAt: string;
	files: number;
	concurrency: number;
	forms: number;
	documents: number;
	downloadMs: number;
	parseMs: number;
	normalizeMs: number;
	indexBuildMs: number;
	searchMs: number;
	indexedDbWriteMs: number;
	indexedDbReadAndParseMs: number;
	storageUsageBefore: number | null;
	storageUsageAfterWrite: number | null;
	longTaskCount: number;
	longTaskMs: number;
	heap: HeapSample[];
	network: NetworkMetric[];
};

type SearchDocument = {
	id: string;
	authority: string;
	title: string;
	categoryPath: string[];
	fieldLabels: string;
};

const strategies: Strategy[] = [
	{
		id: "raw-single",
		label: "Current raw single file",
		url: "/forms.json",
		concurrency: 1,
		split: false,
	},
	{
		id: "cleaned-single",
		label: "Cleaned single file",
		url: "/form-diagnostics/cleaned-single.json",
		concurrency: 1,
		split: false,
	},
	{
		id: "compact-single",
		label: "Compact single file",
		url: "/form-diagnostics/compact-single.json",
		concurrency: 1,
		split: false,
	},
	{
		id: "compact-split-1",
		label: "Compact authority files, sequential",
		url: "/form-diagnostics/compact-authorities/index.json",
		concurrency: 1,
		split: true,
	},
	{
		id: "compact-split-2",
		label: "Compact authority files, 2 concurrent",
		url: "/form-diagnostics/compact-authorities/index.json",
		concurrency: 2,
		split: true,
	},
	{
		id: "compact-split-4",
		label: "Compact authority files, 4 concurrent",
		url: "/form-diagnostics/compact-authorities/index.json",
		concurrency: 4,
		split: true,
	},
];

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

function heapBytes(): number | null {
	const memory = (
		performance as Performance & {
			memory?: { usedJSHeapSize: number };
		}
	).memory;
	return memory?.usedJSHeapSize ?? null;
}

async function storageUsage(): Promise<number | null> {
	if (!navigator.storage?.estimate) return null;
	return (await navigator.storage.estimate()).usage ?? null;
}

function resourceMetric(
	url: string,
): Pick<NetworkMetric, "transferSize" | "encodedBodySize" | "decodedBodySize"> {
	const entry = performance.getEntriesByName(url).at(-1) as
		| PerformanceResourceTiming
		| undefined;
	return {
		transferSize: entry?.transferSize ?? 0,
		encodedBodySize: entry?.encodedBodySize ?? 0,
		decodedBodySize: entry?.decodedBodySize ?? 0,
	};
}

async function download(url: string): Promise<{
	payload: unknown;
	text: string;
	parseMs: number;
	metric: NetworkMetric;
}> {
	const absoluteUrl = new URL(url, window.location.href).href;
	const started = performance.now();
	const response = await fetch(absoluteUrl, { cache: "reload" });
	if (!response.ok)
		throw new Error(`${response.status} ${response.statusText} for ${url}`);
	const text = await response.text();
	const downloadMs = performance.now() - started;
	const parseStarted = performance.now();
	const payload: unknown = JSON.parse(text);
	const parseMs = performance.now() - parseStarted;
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	return {
		payload,
		text,
		parseMs,
		metric: {
			url,
			status: response.status,
			contentEncoding: response.headers.get("content-encoding"),
			contentLength: response.headers.get("content-length"),
			vercelCache: response.headers.get("x-vercel-cache"),
			downloadMs: round(downloadMs),
			...resourceMetric(absoluteUrl),
		},
	};
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function documentsFromPayload(
	payload: unknown,
	prefix: string,
): SearchDocument[] {
	const root = asRecord(payload);
	const authorities = Array.isArray(root.authorities) ? root.authorities : null;
	if (authorities) {
		return authorities.flatMap((authorityValue, authorityIndex) => {
			const authority = asRecord(authorityValue);
			return compactDocuments(
				authority.forms,
				String(authority.name ?? "Unknown authority"),
				`${prefix}-${authorityIndex}`,
			);
		});
	}
	if (root.authority && Array.isArray(root.forms)) {
		const authority = asRecord(root.authority);
		return compactDocuments(
			root.forms,
			String(authority.name ?? "Unknown authority"),
			prefix,
		);
	}
	if (Array.isArray(root.forms)) {
		return root.forms.map((formValue, index) => {
			const form = asRecord(formValue);
			const snapshot = asRecord(form.snapshot);
			const categoryPath = strings(snapshot.categoryPath);
			const fields = Array.isArray(snapshot.fields) ? snapshot.fields : [];
			return {
				id: String(form.sourcePath ?? `${prefix}-${index}`),
				authority: String(snapshot.authority ?? "Unknown authority"),
				title: String(
					snapshot.heading ?? categoryPath.at(-1) ?? "General grievance",
				),
				categoryPath,
				fieldLabels: fields
					.flatMap((fieldValue) => {
						const field = asRecord(fieldValue);
						const id = String(field.id ?? "");
						if (
							field.kind === "search" ||
							(field.kind === "select" && /^category[_-]/i.test(id))
						)
							return [];
						return [String(field.label ?? field.name ?? field.id ?? "Field")];
					})
					.join(" "),
			};
		});
	}
	throw new Error("The downloaded payload has an unknown shape.");
}

function compactDocuments(
	formsValue: unknown,
	authority: string,
	prefix: string,
): SearchDocument[] {
	const forms = Array.isArray(formsValue) ? formsValue : [];
	return forms.map((formValue, index) => {
		const form = asRecord(formValue);
		const fields = Array.isArray(form.fields) ? form.fields : [];
		return {
			id: String(form.id ?? `${prefix}-${index}`),
			authority,
			title: String(form.title ?? "General grievance"),
			categoryPath: strings(form.categoryPath),
			fieldLabels: fields
				.map((fieldValue) => String(asRecord(fieldValue).label ?? "Field"))
				.join(" "),
		};
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("ugaap-form-diagnostics", 1);
		request.onupgradeneeded = () =>
			request.result.createObjectStore("payloads");
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function databaseRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function putPayload(
	database: IDBDatabase,
	key: string,
	text: string,
): Promise<void> {
	await databaseRequest(
		database
			.transaction("payloads", "readwrite")
			.objectStore("payloads")
			.put(text, key),
	);
}

async function readPayload(
	database: IDBDatabase,
	key: string,
): Promise<string> {
	return databaseRequest(
		database.transaction("payloads").objectStore("payloads").get(key),
	) as Promise<string>;
}

async function deletePayload(
	database: IDBDatabase,
	key: string,
): Promise<void> {
	await databaseRequest(
		database
			.transaction("payloads", "readwrite")
			.objectStore("payloads")
			.delete(key),
	);
}

async function mapWithConcurrency<T>(
	items: T[],
	concurrency: number,
	work: (item: T, index: number) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				await work(items[index] as T, index);
			}
		}),
	);
}

async function runTest(
	strategy: Strategy,
	onProgress: (message: string) => void,
): Promise<TestResult> {
	const startedAt = new Date().toISOString();
	const runId = `${strategy.id}-${Date.now()}`;
	const heap: HeapSample[] = [{ stage: "baseline", bytes: heapBytes() }];
	const network: NetworkMetric[] = [];
	const storedKeys: string[] = [];
	const documents: SearchDocument[] = [];
	const longTasks: number[] = [];
	const observer =
		typeof PerformanceObserver === "undefined"
			? null
			: new PerformanceObserver((list) => {
					for (const entry of list.getEntries()) longTasks.push(entry.duration);
				});
	try {
		observer?.observe({
			type: "longtask",
			buffered: false,
		} as PerformanceObserverInit);
	} catch {
		observer?.disconnect();
	}

	const database = await openDatabase();
	const usageBefore = await storageUsage();
	let parseMs = 0;
	let normalizeMs = 0;
	let writeMs = 0;
	let formCount = 0;
	try {
		if (strategy.split) {
			onProgress("Downloading authority index...");
			const indexDownload = await download(strategy.url);
			network.push(indexDownload.metric);
			parseMs += indexDownload.parseMs;
			const indexPayload = asRecord(indexDownload.payload);
			const authorityEntries = Array.isArray(indexPayload.authorities)
				? indexPayload.authorities
				: [];
			formCount = Number(indexPayload.formCount ?? 0);
			await mapWithConcurrency(
				authorityEntries,
				strategy.concurrency,
				async (entryValue, index) => {
					const entry = asRecord(entryValue);
					const asset = String(entry.asset ?? "");
					onProgress(
						`Downloading authority ${index + 1} of ${authorityEntries.length}...`,
					);
					const item = await download(
						`/form-diagnostics/compact-authorities/${asset}`,
					);
					network.push(item.metric);
					parseMs += item.parseMs;
					const normalizeStarted = performance.now();
					documents.push(
						...documentsFromPayload(item.payload, `${strategy.id}-${index}`),
					);
					normalizeMs += performance.now() - normalizeStarted;
					const key = `${runId}:${asset}`;
					const writeStarted = performance.now();
					await putPayload(database, key, item.text);
					writeMs += performance.now() - writeStarted;
					storedKeys.push(key);
				},
			);
		} else {
			onProgress("Downloading payload...");
			const item = await download(strategy.url);
			network.push(item.metric);
			parseMs = item.parseMs;
			const payload = asRecord(item.payload);
			formCount = Number(payload.formCount ?? 0);
			const normalizeStarted = performance.now();
			documents.push(...documentsFromPayload(item.payload, strategy.id));
			normalizeMs = performance.now() - normalizeStarted;
			const key = `${runId}:single`;
			const writeStarted = performance.now();
			await putPayload(database, key, item.text);
			writeMs = performance.now() - writeStarted;
			storedKeys.push(key);
		}

		heap.push({
			stage: "after download, parse, and normalization",
			bytes: heapBytes(),
		});
		onProgress("Building search index without option values...");
		const indexStarted = performance.now();
		const engine = create({
			schema: {
				id: "string",
				authority: "string",
				title: "string",
				categoryPath: "string[]",
				fieldLabels: "string",
			} as const,
			language: "english",
		});
		await insertMultiple(engine, documents, 250);
		const indexBuildMs = performance.now() - indexStarted;
		heap.push({ stage: "after search index", bytes: heapBytes() });

		const searchStarted = performance.now();
		for (const term of ["pension", "bank account", "mobile network"]) {
			await search(engine, { term, limit: 20 });
		}
		const searchMs = performance.now() - searchStarted;

		onProgress("Reading one stored payload from IndexedDB...");
		const readStarted = performance.now();
		const storedText = await readPayload(database, storedKeys[0] as string);
		JSON.parse(storedText);
		const readMs = performance.now() - readStarted;
		heap.push({ stage: "after IndexedDB read and parse", bytes: heapBytes() });
		const usageAfterWrite = await storageUsage();

		return {
			strategyId: strategy.id,
			label: strategy.label,
			startedAt,
			files: network.length,
			concurrency: strategy.concurrency,
			forms: formCount,
			documents: documents.length,
			downloadMs: round(
				network.reduce((total, item) => total + item.downloadMs, 0),
			),
			parseMs: round(parseMs),
			normalizeMs: round(normalizeMs),
			indexBuildMs: round(indexBuildMs),
			searchMs: round(searchMs),
			indexedDbWriteMs: round(writeMs),
			indexedDbReadAndParseMs: round(readMs),
			storageUsageBefore: usageBefore,
			storageUsageAfterWrite: usageAfterWrite,
			longTaskCount: longTasks.length,
			longTaskMs: round(
				longTasks.reduce((total, duration) => total + duration, 0),
			),
			heap,
			network,
		};
	} finally {
		observer?.disconnect();
		await Promise.all(storedKeys.map((key) => deletePayload(database, key)));
		database.close();
	}
}

function deviceDetails() {
	const deviceNavigator = navigator as Navigator & {
		deviceMemory?: number;
		connection?: {
			effectiveType?: string;
			downlink?: number;
			rtt?: number;
			saveData?: boolean;
		};
	};
	return {
		capturedAt: new Date().toISOString(),
		page: window.location.href,
		userAgent: navigator.userAgent,
		language: navigator.language,
		deviceMemoryGb: deviceNavigator.deviceMemory ?? null,
		hardwareConcurrency: navigator.hardwareConcurrency ?? null,
		connection: deviceNavigator.connection ?? null,
	};
}

function formatMb(bytes: number | null): string {
	return bytes === null
		? "Unavailable"
		: `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FormDiagnostics() {
	const [results, setResults] = useState<TestResult[]>([]);
	const [running, setRunning] = useState<string | null>(null);
	const [status, setStatus] = useState("Ready.");
	const [device, setDevice] = useState<ReturnType<typeof deviceDetails> | null>(
		null,
	);
	useEffect(() => setDevice(deviceDetails()), []);
	const output = JSON.stringify({ device, results }, null, 2);

	async function execute(strategy: Strategy) {
		setRunning(strategy.id);
		setStatus(`Starting ${strategy.label}...`);
		try {
			const result = await runTest(strategy, setStatus);
			setResults((current) => [
				...current.filter((item) => item.strategyId !== strategy.id),
				result,
			]);
			setStatus(`${strategy.label} finished.`);
		} catch (error) {
			setStatus(
				`Failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setRunning(null);
		}
	}

	async function copyResults() {
		await navigator.clipboard.writeText(output);
		setStatus("Results copied.");
	}

	function downloadResults() {
		const blobUrl = URL.createObjectURL(
			new Blob([output], { type: "application/json" }),
		);
		const anchor = document.createElement("a");
		anchor.href = blobUrl;
		anchor.download = `ugaap-form-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
		anchor.click();
		URL.revokeObjectURL(blobUrl);
	}

	return (
		<main style={{ margin: "0 auto", maxWidth: 1100, padding: 24 }}>
			<h1>Form delivery diagnostics</h1>
			<p>
				Run one test at a time. Reload this page between tests when comparing
				memory on a low-memory phone. Results stay on this device.
			</p>
			<p>
				<strong>Status:</strong> {status}
			</p>
			<div
				style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}
			>
				{strategies.map((strategy) => (
					<button
						disabled={running !== null}
						key={strategy.id}
						onClick={() => execute(strategy)}
						type="button"
					>
						{running === strategy.id ? "Running..." : strategy.label}
					</button>
				))}
			</div>
			<div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
				<button
					disabled={results.length === 0 || running !== null}
					onClick={copyResults}
					type="button"
				>
					Copy JSON
				</button>
				<button
					disabled={results.length === 0 || running !== null}
					onClick={downloadResults}
					type="button"
				>
					Download JSON
				</button>
				<button
					disabled={running !== null}
					onClick={() => setResults([])}
					type="button"
				>
					Clear results
				</button>
			</div>
			<div style={{ overflowX: "auto" }}>
				<table style={{ borderCollapse: "collapse", width: "100%" }}>
					<thead>
						<tr>
							{[
								"Strategy",
								"Files",
								"Download",
								"Parse",
								"Normalize",
								"Index",
								"IDB write",
								"IDB read",
								"Long tasks",
								"Peak heap",
							].map((heading) => (
								<th
									key={heading}
									style={{
										border: "1px solid #999",
										padding: 6,
										textAlign: "left",
									}}
								>
									{heading}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{results.map((result) => {
							const heaps = result.heap.flatMap((sample) =>
								sample.bytes === null ? [] : [sample.bytes],
							);
							return (
								<tr key={result.strategyId}>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.label}
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.files}
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.downloadMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.parseMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.normalizeMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.indexBuildMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.indexedDbWriteMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.indexedDbReadAndParseMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{result.longTaskCount} / {result.longTaskMs} ms
									</td>
									<td style={{ border: "1px solid #999", padding: 6 }}>
										{formatMb(heaps.length ? Math.max(...heaps) : null)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<h2>Raw JSON output</h2>
			<pre style={{ maxHeight: 500, overflow: "auto", whiteSpace: "pre-wrap" }}>
				{output}
			</pre>
		</main>
	);
}
