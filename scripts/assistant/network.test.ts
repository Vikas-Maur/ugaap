import assert from "node:assert/strict";
import test from "node:test";
import {
	classifyNetworkKbps,
	createNetworkProbeRunner,
	formatNetworkSpeed,
	initialNetworkSnapshot,
	isNetworkSnapshotStale,
	measureNetworkProbe,
	NETWORK_PROBE_BYTES,
	NETWORK_SAMPLE_MAX_AGE_MS,
} from "../../src/features/network/probe";

test("network classification uses the slow threshold and recovery margin", () => {
	assert.equal(classifyNetworkKbps(150, "fast"), "slow");
	assert.equal(classifyNetworkKbps(151, "fast"), "fast");
	assert.equal(classifyNetworkKbps(199, "slow"), "slow");
	assert.equal(classifyNetworkKbps(200, "slow"), "fast");
});

test("network speed labels scale from kbps to Mbps and Gbps", () => {
	assert.equal(formatNetworkSpeed(999), "999 kbps");
	assert.equal(formatNetworkSpeed(14_727), "14.7 Mbps");
	assert.equal(formatNetworkSpeed(1_250_000), "1.3 Gbps");
});

test("network snapshots expire after fifteen minutes", () => {
	assert.equal(isNetworkSnapshotStale(initialNetworkSnapshot, 1), true);
	const snapshot = {
		...initialNetworkSnapshot,
		quality: "fast" as const,
		measuredAt: 1_000,
	};
	assert.equal(
		isNetworkSnapshotStale(snapshot, 1_000 + NETWORK_SAMPLE_MAX_AGE_MS - 1),
		false,
	);
	assert.equal(
		isNetworkSnapshotStale(snapshot, 1_000 + NETWORK_SAMPLE_MAX_AGE_MS),
		true,
	);
});

test("the request probe measures transferred bytes", async () => {
	let clock = 0;
	const snapshot = await measureNetworkProbe({
		fetchImpl: async () => {
			clock = 1_000;
			return new Response(new Uint8Array(NETWORK_PROBE_BYTES));
		},
		now: () => clock,
	});
	assert.equal(snapshot.transferredBytes, NETWORK_PROBE_BYTES);
	assert.equal(snapshot.estimatedKbps, 131.072);
	assert.equal(snapshot.quality, "slow");
});

test("failed probes report unavailable", async () => {
	const snapshot = await measureNetworkProbe({
		fetchImpl: async () => {
			throw new Error("network stopped");
		},
		now: () => 10,
	});
	assert.equal(snapshot.quality, "unavailable");
	assert.equal(snapshot.estimatedKbps, null);
});

test("slow probes stop at the timeout", async () => {
	const snapshot = await measureNetworkProbe({
		fetchImpl: async (_input, init) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("Stopped", "AbortError"));
				});
			}),
		timeoutMs: 1,
	});
	assert.equal(snapshot.quality, "unavailable");
});

test("concurrent network checks share one probe request", async () => {
	let finish: ((snapshot: typeof initialNetworkSnapshot) => void) | undefined;
	let requests = 0;
	const runner = createNetworkProbeRunner(
		() =>
			new Promise((resolve) => {
				requests += 1;
				finish = resolve;
			}),
	);
	const first = runner();
	const second = runner();
	assert.equal(first, second);
	assert.equal(requests, 1);
	finish?.(initialNetworkSnapshot);
	await first;
});
