import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationFormDrawer } from "@/components/integrations/IntegrationFormDrawer";
import { useIntegrationsHealth } from "@/context/IntegrationsHealthContext";
import { api } from "@/lib/api";
import type { Integration } from "@/types/api";
import { useEffect, useState } from "react";

export default function IntegrationsPage() {
	const { refresh: refreshHealth } = useIntegrationsHealth();
	const [integrations, setIntegrations] = useState<Integration[]>([]);
	const [loading, setLoading] = useState(true);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editing, setEditing] = useState<Integration | null>(null);

	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [clearingDataId, setClearingDataId] = useState<string | null>(null);
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [resettingId, setResettingId] = useState<string | null>(null);
	const [pausingId, setPausingId] = useState<string | null>(null);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [recentlySyncedId, setRecentlySyncedId] = useState<string | null>(null);

	useEffect(() => {
		api.integrations
			.list()
			.then(setIntegrations)
			.finally(() => setLoading(false));
	}, []);

	function openCreate() {
		setEditing(null);
		setDrawerOpen(true);
	}

	function openEdit(integration: Integration) {
		setEditing(integration);
		setDrawerOpen(true);
	}

	function closeDrawer() {
		setDrawerOpen(false);
	}

	function handleSaved(integration: Integration, mode: "create" | "update") {
		if (mode === "update") {
			setIntegrations((prev) => prev.map((i) => (i.id === integration.id ? integration : i)));
		} else {
			setIntegrations((prev) => [integration, ...prev]);
		}
		setDrawerOpen(false);
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await api.integrations.remove(id);
			setIntegrations((prev) => prev.filter((i) => i.id !== id));
			refreshHealth();
		} finally {
			setDeletingId(null);
		}
	}

	async function handleClearData(id: string) {
		setClearingDataId(id);
		try {
			await api.integrations.clearData(id);
			setIntegrations((prev) =>
				prev.map((i) =>
					i.id === id
						? { ...i, eventCount: 0, lastSyncAt: null, lastSyncError: null }
						: i,
				),
			);
			refreshHealth();
		} finally {
			setClearingDataId(null);
		}
	}

	async function handleResetCursor(id: string) {
		setResettingId(id);
		try {
			await api.integrations.resetCursor(id);
			setIntegrations((prev) =>
				prev.map((i) => (i.id === id ? { ...i, lastSyncAt: null, lastSyncError: null } : i)),
			);
			refreshHealth();
		} finally {
			setResettingId(null);
		}
	}

	async function handleSyncNow(id: string) {
		setSyncingId(id);
		try {
			const result = await api.integrations.syncNow(id);
			setIntegrations((prev) =>
				prev.map((i) =>
					i.id === id
						? { ...i, lastSyncAt: result.syncedAt, lastSyncError: result.error }
						: i,
				),
			);
			refreshHealth();
			if (!result.error) {
				setRecentlySyncedId(id);
				setTimeout(() => {
					setRecentlySyncedId((current) => (current === id ? null : current));
				}, 4000);
			}
		} finally {
			setSyncingId(null);
		}
	}

	async function handlePause(id: string) {
		setPausingId(id);
		try {
			const updated = await api.integrations.pause(id);
			setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
			refreshHealth();
		} finally {
			setPausingId(null);
		}
	}

	async function handleResume(id: string) {
		setResumingId(id);
		try {
			await api.integrations.resume(id);
			const refreshed = await api.integrations.list();
			setIntegrations(refreshed);
			refreshHealth();
		} finally {
			setResumingId(null);
		}
	}

	if (loading) return <p className="text-sm text-text-3">Loading…</p>;

	return (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold text-text-1">Integrations</h1>
					<p className="mt-0.5 text-xs text-text-3">
						Connect external sources to ingest events into the platform.
					</p>
				</div>
				<button
					type="button"
					onClick={openCreate}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					Add integration
				</button>
			</div>

			{integrations.length === 0 ? (
				<div className="rounded-lg border border-dashed border-edge bg-surface-900/50 px-6 py-12 text-center">
					<p className="text-sm text-text-2">No integrations yet.</p>
					<p className="mt-1 text-xs text-text-4">
						Add your first one to start ingesting events.
					</p>
					<button
						type="button"
						onClick={openCreate}
						className="btn-primary mt-4 rounded-md px-4 py-2 text-sm font-medium"
					>
						Add integration
					</button>
				</div>
			) : (
				<div className="space-y-3">
					{integrations.map((integration) => (
						<IntegrationCard
							key={integration.id}
							integration={integration}
							syncJustSucceeded={recentlySyncedId === integration.id}
							syncing={syncingId === integration.id}
							pausing={pausingId === integration.id}
							resuming={resumingId === integration.id}
							resetting={resettingId === integration.id}
							clearingData={clearingDataId === integration.id}
							deleting={deletingId === integration.id}
							onEdit={() => openEdit(integration)}
							onSyncNow={() => handleSyncNow(integration.id)}
							onPause={() => handlePause(integration.id)}
							onResume={() => handleResume(integration.id)}
							onResetCursor={() => handleResetCursor(integration.id)}
							onClearData={() => handleClearData(integration.id)}
							onDelete={() => handleDelete(integration.id)}
						/>
					))}
				</div>
			)}

			<IntegrationFormDrawer
				open={drawerOpen}
				editing={editing}
				onClose={closeDrawer}
				onSaved={handleSaved}
			/>
		</div>
	);
}
