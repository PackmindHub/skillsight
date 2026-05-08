import { api } from "@/lib/api";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

interface IntegrationsHealthValue {
	errorCount: number;
	loading: boolean;
	refresh: () => Promise<void>;
}

const IntegrationsHealthContext = createContext<IntegrationsHealthValue | null>(null);

export function IntegrationsHealthProvider({ children }: { children: ReactNode }) {
	const [errorCount, setErrorCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const refresh = useCallback(async () => {
		try {
			const items = await api.integrations.list();
			setErrorCount(items.filter((i) => i.lastSyncError).length);
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
		<IntegrationsHealthContext.Provider value={{ errorCount, loading, refresh }}>
			{children}
		</IntegrationsHealthContext.Provider>
	);
}

export function useIntegrationsHealth() {
	const ctx = useContext(IntegrationsHealthContext);
	if (!ctx) throw new Error("useIntegrationsHealth must be used within IntegrationsHealthProvider");
	return ctx;
}
