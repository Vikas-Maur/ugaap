export const NETWORK_PROBE_BYTES = 16 * 1024;
export const NETWORK_PROBE_TIMEOUT_MS = 5_000;
export const NETWORK_SAMPLE_MAX_AGE_MS = 15 * 60 * 1_000;
export const SLOW_NETWORK_KBPS = 150;
export const FAST_NETWORK_KBPS = 200;

export type NetworkQuality = "checking" | "fast" | "slow" | "unavailable";

export type NetworkSnapshot = {
	quality: NetworkQuality;
	estimatedKbps: number | null;
	transferredBytes: number;
	durationMs: number | null;
	measuredAt: number | null;
};

export const initialNetworkSnapshot: NetworkSnapshot = {
	quality: "checking",
	estimatedKbps: null,
	transferredBytes: 0,
	durationMs: null,
	measuredAt: null,
};

export function classifyNetworkKbps(
	kbps: number,
	previousQuality: NetworkQuality,
): NetworkQuality {
	if (previousQuality === "slow") {
		return kbps < FAST_NETWORK_KBPS ? "slow" : "fast";
	}
	return kbps <= SLOW_NETWORK_KBPS ? "slow" : "fast";
}

export function formatNetworkSpeed(kbps: number): string {
	if (kbps >= 1_000_000) {
		return `${Math.round((kbps / 1_000_000) * 10) / 10} Gbps`;
	}
	if (kbps >= 1_000) {
		return `${Math.round((kbps / 1_000) * 10) / 10} Mbps`;
	}
	return `${Math.round(kbps)} kbps`;
}

export function isNetworkSnapshotStale(
	snapshot: NetworkSnapshot,
	now = Date.now(),
): boolean {
	return (
		snapshot.measuredAt === null ||
		now - snapshot.measuredAt >= NETWORK_SAMPLE_MAX_AGE_MS
	);
}

type ProbeOptions = {
	previousQuality?: NetworkQuality;
	fetchImpl?: typeof fetch;
	now?: () => number;
	timeoutMs?: number;
};

export function createNetworkProbeRunner(
	measure: () => Promise<NetworkSnapshot>,
): () => Promise<NetworkSnapshot> {
	let pending: Promise<NetworkSnapshot> | null = null;
	return () => {
		if (pending) return pending;
		pending = measure();
		void pending.finally(() => {
			pending = null;
		});
		return pending;
	};
}

export async function measureNetworkProbe({
	previousQuality = "checking",
	fetchImpl = fetch,
	now = () => performance.now(),
	timeoutMs = NETWORK_PROBE_TIMEOUT_MS,
}: ProbeOptions = {}): Promise<NetworkSnapshot> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const startedAt = now();

	try {
		const response = await fetchImpl(
			`/api/network/probe?request=${crypto.randomUUID()}`,
			{
				cache: "no-store",
				credentials: "omit",
				signal: controller.signal,
			},
		);
		if (!response.ok) throw new Error(`Probe returned ${response.status}.`);
		const payload = await response.arrayBuffer();
		const durationMs = Math.max(now() - startedAt, 1);
		const transferredBytes = payload.byteLength;
		if (transferredBytes !== NETWORK_PROBE_BYTES) {
			throw new Error("Probe returned an unexpected payload size.");
		}
		const estimatedKbps = (transferredBytes * 8) / durationMs;
		return {
			quality: classifyNetworkKbps(estimatedKbps, previousQuality),
			estimatedKbps,
			transferredBytes,
			durationMs,
			measuredAt: Date.now(),
		};
	} catch {
		return {
			quality: "unavailable",
			estimatedKbps: null,
			transferredBytes: 0,
			durationMs: Math.max(now() - startedAt, 1),
			measuredAt: Date.now(),
		};
	} finally {
		clearTimeout(timeout);
	}
}
