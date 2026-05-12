import { DirectIntegrationCard } from "@/components/integrations/DirectIntegrationCard";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { IntegrationFormDrawer } from "@/components/integrations/IntegrationFormDrawer";
import { Button, PageHeader } from "@/components/ui";
import { useIntegrationsHealth } from "@/context/IntegrationsHealthContext";
import { api } from "@/lib/api";
import type { Integration } from "@/types/api";
import { useState } from "react";

export default function IntegrationsPage() {
	const { integrations, loading } = useIntegrationsHealth();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editing, setEditing] = useState<Integration | null>(null);

	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [clearingDataId, setClearingDataId] = useState<string | null>(null);
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [resettingId, setResettingId] = useState<string | null>(null);
	const [pausingId, setPausingId] = useState<string | null>(null);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [recentlySyncedId, setRecentlySyncedId] = useState<string | null>(null);

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

	function handleSaved(_integration: Integration, _mode: "create" | "update") {
		// SSE pushes the new/updated row into IntegrationsHealthContext; just close.
		setDrawerOpen(false);
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await api.integrations.remove(id);
		} finally {
			setDeletingId(null);
		}
	}

	async function handleClearData(id: string) {
		setClearingDataId(id);
		try {
			await api.integrations.clearData(id);
		} finally {
			setClearingDataId(null);
		}
	}

	async function handleResetCursor(id: string) {
		setResettingId(id);
		try {
			await api.integrations.resetCursor(id);
		} finally {
			setResettingId(null);
		}
	}

	async function handleSyncNow(id: string) {
		setSyncingId(id);
		try {
			const result = await api.integrations.syncNow(id);
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
			await api.integrations.pause(id);
		} finally {
			setPausingId(null);
		}
	}

	async function handleResume(id: string) {
		setResumingId(id);
		try {
			await api.integrations.resume(id);
		} finally {
			setResumingId(null);
		}
	}

	if (loading) return <p className="text-sm text-text-3">Loading…</p>;

	return (
		<div className="space-y-5">
			<PageHeader
				title="Integrations"
				subtitle="Connect external sources to ingest events into the platform."
				actions={<Button onClick={openCreate}>Add integration</Button>}
			/>

			<div className="space-y-3">
				<DirectIntegrationCard />
				{integrations.length === 0 ? (
					<div className="rounded-lg border border-dashed border-edge bg-surface-900/50 px-6 py-12 text-center">
						<p className="text-sm text-text-2">No external integrations yet.</p>
						<p className="mt-1 text-xs text-text-4">
							Connect a Loki source to pull events from your existing observability stack.
						</p>
						<div className="mt-4 inline-flex">
							<Button onClick={openCreate}>Add integration</Button>
						</div>
					</div>
				) : (
					integrations.map((integration) => (
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
					))
				)}
			</div>

			<IntegrationFormDrawer
				open={drawerOpen}
				editing={editing}
				onClose={closeDrawer}
				onSaved={handleSaved}
			/>
		</div>
	);
}
