import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	createNetworkProbeRunner,
	initialNetworkSnapshot,
	isNetworkSnapshotStale,
	measureNetworkProbe,
	NETWORK_SAMPLE_MAX_AGE_MS,
	type NetworkSnapshot,
} from "./probe";

type NetworkStatusContextValue = {
	snapshot: NetworkSnapshot;
	isStale: boolean;
	checkNow: () => Promise<NetworkSnapshot>;
};

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(
	null,
);

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
	const [snapshot, setSnapshot] = useState(initialNetworkSnapshot);
	const snapshotRef = useRef(snapshot);
	const mountedRef = useRef(true);
	const runnerRef = useRef<(() => Promise<NetworkSnapshot>) | null>(null);
	snapshotRef.current = snapshot;
	runnerRef.current ??= createNetworkProbeRunner(async () => {
		const next = await measureNetworkProbe({
			previousQuality: snapshotRef.current.quality,
		});
		if (mountedRef.current) setSnapshot(next);
		return next;
	});

	const checkNow = useCallback(
		() => runnerRef.current?.() ?? Promise.resolve(snapshotRef.current),
		[],
	);

	useEffect(() => {
		mountedRef.current = true;
		void checkNow();
		const timer = window.setInterval(
			() => {
				if (
					document.visibilityState === "visible" &&
					isNetworkSnapshotStale(snapshotRef.current)
				) {
					void checkNow();
				}
			},
			Math.min(NETWORK_SAMPLE_MAX_AGE_MS, 60_000),
		);
		const handleVisibilityChange = () => {
			if (
				document.visibilityState === "visible" &&
				isNetworkSnapshotStale(snapshotRef.current)
			) {
				void checkNow();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			mountedRef.current = false;
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [checkNow]);

	const value = useMemo(
		() => ({
			snapshot,
			isStale: isNetworkSnapshotStale(snapshot),
			checkNow,
		}),
		[snapshot, checkNow],
	);

	return (
		<NetworkStatusContext.Provider value={value}>
			{children}
		</NetworkStatusContext.Provider>
	);
}

export function useNetworkStatus(): NetworkStatusContextValue {
	const context = useContext(NetworkStatusContext);
	if (!context) {
		throw new Error(
			"useNetworkStatus must be used within NetworkStatusProvider.",
		);
	}
	return context;
}
