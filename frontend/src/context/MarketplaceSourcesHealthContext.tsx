import { api } from "@/lib/api";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

interface MarketplaceSourcesHealthValue {
	errorCount: number;
	loading: boolean;
	refresh: () => Promise<void>;
}

const MarketplaceSourcesHealthContext = createContext<MarketplaceSourcesHealthValue | null>(null);

export function MarketplaceSourcesHealthProvider({ children }: { children: ReactNode }) {
	const [errorCount, setErrorCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const refresh = useCallback(async () => {
		try {
			const items = await api.marketplaceSources.list();
			setErrorCount(items.filter((s) => s.lastSyncError).length);
		} catch {
			// Silent: a transient list failure shouldn't crash the shell.
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();

		function start() {
			if (intervalRef.current !== null) return;
			intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
		}

		function stop() {
			if (intervalRef.current === null) return;
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		function onVisibilityChange() {
			if (document.visibilityState === "hidden") {
				stop();
			} else {
				refresh();
				start();
			}
		}

		if (document.visibilityState === "visible") start();
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			stop();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [refresh]);

	return (
		<MarketplaceSourcesHealthContext.Provider value={{ errorCount, loading, refresh }}>
			{children}
		</MarketplaceSourcesHealthContext.Provider>
	);
}

export function useMarketplaceSourcesHealth() {
	const ctx = useContext(MarketplaceSourcesHealthContext);
	if (!ctx)
		throw new Error("useMarketplaceSourcesHealth must be used within MarketplaceSourcesHealthProvider");
	return ctx;
}
