import { api } from "@/lib/api";
import type { Integration } from "@/types/api";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface IntegrationsHealthValue {
	integrations: Integration[];
	errorCount: number;
	loading: boolean;
	refresh: () => Promise<void>;
}

const IntegrationsHealthContext = createContext<IntegrationsHealthValue | null>(null);

export function IntegrationsHealthProvider({ children }: { children: ReactNode }) {
	const [integrations, setIntegrations] = useState<Integration[]>([]);
	const [loading, setLoading] = useState(true);
	const closeStreamRef = useRef<(() => void) | null>(null);

	const refresh = useCallback(async () => {
		try {
			const items = await api.integrations.list();
			setIntegrations(items);
		} catch {
			// Silent: a transient list failure shouldn't crash the shell.
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		function applyUpdate(updated: Integration) {
			setIntegrations((prev) => {
				const idx = prev.findIndex((i) => i.id === updated.id);
				if (idx === -1) return [updated, ...prev];
				const next = prev.slice();
				next[idx] = updated;
				return next;
			});
		}

		function applyDelete(id: string) {
			setIntegrations((prev) => prev.filter((i) => i.id !== id));
		}

		function openStream() {
			if (closeStreamRef.current) return;
			closeStreamRef.current = api.integrations.openStream({
				onUpdate: applyUpdate,
				onDelete: applyDelete,
			});
		}

		function closeStream() {
			closeStreamRef.current?.();
			closeStreamRef.current = null;
		}

		refresh().then(() => {
			if (document.visibilityState === "visible") openStream();
		});

		function onVisibilityChange() {
			if (document.visibilityState === "hidden") {
				closeStream();
			} else {
				refresh().then(openStream);
			}
		}

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			closeStream();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [refresh]);

	const errorCount = useMemo(
		() => integrations.filter((i) => i.lastSyncError).length,
		[integrations],
	);

	return (
		<IntegrationsHealthContext.Provider value={{ integrations, errorCount, loading, refresh }}>
			{children}
		</IntegrationsHealthContext.Provider>
	);
}

export function useIntegrationsHealth() {
	const ctx = useContext(IntegrationsHealthContext);
	if (!ctx) throw new Error("useIntegrationsHealth must be used within IntegrationsHealthProvider");
	return ctx;
}
