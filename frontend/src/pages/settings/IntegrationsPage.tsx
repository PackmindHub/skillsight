import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { Integration, IntegrationPreviewEvent } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

type AuthType = "none" | "basic";

interface FormState {
	name: string;
	url: string;
	authType: AuthType;
	authUsername: string;
	authPassword: string;
	lokiQuery: string;
	syncIntervalSecs: string;
	enabled: boolean;
}

const defaultForm: FormState = {
	name: "",
	url: "",
	authType: "none",
	authUsername: "",
	authPassword: "",
	lokiQuery: '{service_name="claude-code"} | event_name=~`skill_activated|plugin_installed`',
	syncIntervalSecs: "30",
	enabled: true,
};

export default function IntegrationsPage() {
	const [integrations, setIntegrations] = useState<Integration[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<FormState>(defaultForm);
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [clearingDataId, setClearingDataId] = useState<string | null>(null);
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [resettingId, setResettingId] = useState<string | null>(null);
	const [pausingId, setPausingId] = useState<string | null>(null);
	const [resumingId, setResumingId] = useState<string | null>(null);
	const [syncResult, setSyncResult] = useState<Record<string, { syncedAt: string | null; error: string | null }>>({});
	const [previewEvents, setPreviewEvents] = useState<IntegrationPreviewEvent[] | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	useEffect(() => {
		api.integrations
			.list()
			.then(setIntegrations)
			.finally(() => setLoading(false));
	}, []);

	function openCreate() {
		setEditingId(null);
		setForm(defaultForm);
		setShowForm(true);
	}

	function openEdit(integration: Integration) {
		setEditingId(integration.id);
		setForm({
			name: integration.name,
			url: integration.url,
			authType: integration.authType,
			authUsername: integration.authUsername ?? "",
			authPassword: "",
			lokiQuery: integration.lokiQuery,
			syncIntervalSecs: String(Math.round(integration.syncIntervalMs / 1000)),
			enabled: integration.enabled,
		});
		setShowForm(true);
	}

	function closeForm() {
		setShowForm(false);
		setEditingId(null);
		setPreviewEvents(null);
		setPreviewError(null);
	}

	function resetPreview() {
		setPreviewEvents(null);
		setPreviewError(null);
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const payload = {
				name: form.name,
				url: form.url,
				authType: form.authType,
				authUsername: form.authType === "basic" ? form.authUsername || null : null,
				authPassword: form.authType === "basic" && form.authPassword ? form.authPassword : null,
				lokiQuery: form.lokiQuery,
				syncIntervalMs: Number(form.syncIntervalSecs) * 1000,
				enabled: form.enabled,
			};

			if (editingId) {
				const updated = await api.integrations.update(editingId, payload);
				setIntegrations((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
			} else {
				const created = await api.integrations.create(payload);
				setIntegrations((prev) => [created, ...prev]);
			}
			closeForm();
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await api.integrations.remove(id);
			setIntegrations((prev) => prev.filter((i) => i.id !== id));
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
					i.id === id ? { ...i, eventCount: 0, lastSyncAt: null, lastSyncError: null } : i,
				),
			);
		} finally {
			setClearingDataId(null);
		}
	}

	async function handlePreview() {
		setPreviewing(true);
		setPreviewEvents(null);
		setPreviewError(null);
		try {
			const results = await api.integrations.preview({
				url: form.url,
				authType: form.authType,
				authUsername: form.authType === "basic" ? form.authUsername || null : null,
				authPassword: form.authType === "basic" && form.authPassword ? form.authPassword : null,
				lokiQuery: form.lokiQuery,
				integrationId: editingId,
			});
			setPreviewEvents(results);
		} catch (err) {
			setPreviewError(err instanceof Error ? err.message : "Preview failed");
		} finally {
			setPreviewing(false);
		}
	}

	async function handleResetCursor(id: string) {
		setResettingId(id);
		try {
			await api.integrations.resetCursor(id);
			setIntegrations((prev) =>
				prev.map((i) => (i.id === id ? { ...i, lastSyncAt: null, lastSyncError: null } : i)),
			);
		} finally {
			setResettingId(null);
		}
	}

	async function handleSyncNow(id: string) {
		setSyncingId(id);
		try {
			const result = await api.integrations.syncNow(id);
			setSyncResult((prev) => ({ ...prev, [id]: result }));
			setIntegrations((prev) =>
				prev.map((i) =>
					i.id === id
						? {
								...i,
								lastSyncAt: result.syncedAt,
								lastSyncError: result.error,
							}
						: i,
				),
			);
		} finally {
			setSyncingId(null);
		}
	}

	async function handlePause(id: string) {
		setPausingId(id);
		try {
			const updated = await api.integrations.pause(id);
			setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
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
		} finally {
			setResumingId(null);
		}
	}

	const inputClass = "w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright";

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold text-text-1">Integrations</h1>
				<button
					type="button"
					onClick={openCreate}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					Add integration
				</button>
			</div>

			{showForm && (
				<div className="bg-surface-700 rounded-lg border border-edge p-4">
					<h2 className="text-sm font-medium text-text-1 mb-3">
						{editingId ? "Edit integration" : "New integration"}
					</h2>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="int-name" className="block text-xs text-text-3 mb-1">
									Name *
								</label>
								<input
									id="int-name"
									required
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
									className={inputClass}
									placeholder="My Loki"
								/>
							</div>
							<div>
								<label htmlFor="int-url" className="block text-xs text-text-3 mb-1">
									Loki URL *
								</label>
								<input
									id="int-url"
									required
									type="url"
									value={form.url}
									onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
									className={inputClass}
									placeholder="https://loki.example.com"
								/>
							</div>
						</div>

						<div>
							<p className="text-xs text-text-3 mb-1.5">Authentication</p>
							<div className="flex gap-4">
								{(["none", "basic"] as AuthType[]).map((val) => (
									<label key={val} className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
										<input
											type="radio"
											name="authType"
											value={val}
											checked={form.authType === val}
											onChange={() => setForm((f) => ({ ...f, authType: val }))}
										/>
										{val === "none" ? "No authentication" : "Basic authentication"}
									</label>
								))}
							</div>
						</div>

						{form.authType === "basic" && (
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label htmlFor="int-user" className="block text-xs text-text-3 mb-1">
										Username
									</label>
									<input
										id="int-user"
										value={form.authUsername}
										onChange={(e) => setForm((f) => ({ ...f, authUsername: e.target.value }))}
										className={inputClass}
										autoComplete="off"
									/>
								</div>
								<div>
									<label htmlFor="int-pass" className="block text-xs text-text-3 mb-1">
										Password{editingId ? " (leave blank to keep existing)" : ""}
									</label>
									<input
										id="int-pass"
										type="password"
										value={form.authPassword}
										onChange={(e) => setForm((f) => ({ ...f, authPassword: e.target.value }))}
										className={inputClass}
										placeholder={editingId ? "••••••" : ""}
										autoComplete="new-password"
									/>
								</div>
							</div>
						)}

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="int-query" className="block text-xs text-text-3 mb-1">
									LogQL query
								</label>
								<div className="flex gap-2">
									<input
										id="int-query"
										value={form.lokiQuery}
										onChange={(e) => {
											setForm((f) => ({ ...f, lokiQuery: e.target.value }));
											resetPreview();
										}}
										className={`${inputClass} font-mono flex-1`}
									/>
									<button
										type="button"
										disabled={previewing || !form.url}
										onClick={handlePreview}
										className="rounded border border-edge px-3 py-1.5 text-xs text-text-2 hover:bg-surface-800 hover:text-text-1 disabled:opacity-40 transition-colors whitespace-nowrap"
									>
										{previewing ? "Loading…" : "Preview ▶"}
									</button>
								</div>
							</div>
							<div>
								<label htmlFor="int-interval" className="block text-xs text-text-3 mb-1">
									Sync interval (seconds)
								</label>
								<input
									id="int-interval"
									type="number"
									min="5"
									value={form.syncIntervalSecs}
									onChange={(e) => setForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))}
									className={inputClass}
								/>
							</div>
						</div>

						{(previewEvents !== null || previewError) && (
							<div className="rounded border border-edge bg-surface-800 p-3 text-xs space-y-2">
								<p className="text-text-3 font-medium">Preview — last 7 days</p>
								{previewError && (
									<p className="text-danger">{previewError}</p>
								)}
								{previewEvents !== null && previewEvents.length === 0 && (
									<p className="text-text-4">No matching events found in the last 7 days.</p>
								)}
								{previewEvents !== null && previewEvents.length > 0 && (
									<ul className="space-y-2">
										{previewEvents.map((ev, i) => {
											const label = ev.eventName.replace("claude_code.", "");
											const skillName = ev.attributes["skill.name"] as string | undefined;
											const pluginName = ev.attributes["plugin.name"] as string | undefined;
											const detail = skillName ?? pluginName ?? null;
											return (
												// biome-ignore lint/suspicious/noArrayIndexKey: static preview list
												<li key={i} className="flex flex-col gap-0.5">
													<div className="flex items-center gap-2">
														<span className="badge badge-neutral">{label}</span>
														{detail && <span className="text-text-1 font-medium">{detail}</span>}
													</div>
													<div className="text-text-4">
														{ev.userEmail ?? "unknown"} · {formatDateTime(ev.timestamp)}
													</div>
												</li>
											);
										})}
									</ul>
								)}
							</div>
						)}

						<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
							<input
								type="checkbox"
								checked={form.enabled}
								onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
							/>
							Enable sync
						</label>

						<div className="flex gap-2">
							<button
								type="submit"
								disabled={saving}
								className="btn-primary rounded px-3 py-1.5 text-sm"
							>
								{saving ? "Saving…" : editingId ? "Update" : "Create"}
							</button>
							<button
								type="button"
								onClick={closeForm}
								className="rounded border border-edge px-3 py-1.5 text-sm text-text-3 hover:bg-surface-800 hover:text-text-1 transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-surface-800 border-b border-edge">
						<tr>
							<th className="text-left px-4 py-3 font-medium text-text-3">Name</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Type</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">URL</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Auth</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Interval</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Last sync</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Ingested</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{integrations.map((integration) => {
							const sr = syncResult[integration.id];
							const hasError = integration.lastSyncError !== null;

							return (
								<tr key={integration.id} className={`border-b border-edge-dim transition-colors ${!integration.enabled ? "opacity-40" : "hover:bg-surface-800"}`}>
									<td className="px-4 py-3 font-medium text-text-1">
										{integration.name}
										{!integration.enabled && (
											<span className="ml-2 badge badge-neutral">paused</span>
										)}
									</td>
									<td className="px-4 py-3 text-text-3">
										{integration.type.charAt(0).toUpperCase() + integration.type.slice(1)}
									</td>
									<td className="px-4 py-3 text-text-3 max-w-xs truncate">
										<span title={integration.url}>{integration.url}</span>
									</td>
									<td className="px-4 py-3 text-text-3">
										{integration.authType === "basic" ? "Basic" : "None"}
									</td>
									<td className="px-4 py-3 text-text-3">
										{Math.round(integration.syncIntervalMs / 1000)}s
									</td>
									<td className="px-4 py-3">
										{hasError ? (
											<span className="badge badge-danger" title={integration.lastSyncError ?? ""}>
												Error
											</span>
										) : integration.lastSyncAt ? (
											<span className="text-text-3 text-xs">
												{formatDateTime(integration.lastSyncAt)}
											</span>
										) : (
											<span className="text-text-4 text-xs">Never</span>
										)}
										{sr && !sr.error && (
											<span className="ml-2 text-xs text-success">Synced</span>
										)}
									</td>
									<td className="px-4 py-3 text-text-3 text-xs">
										{(integration.eventCount ?? 0).toLocaleString()}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex items-center justify-end gap-3">
											{integration.enabled ? (
												<button
													type="button"
													disabled={pausingId === integration.id}
													onClick={() => handlePause(integration.id)}
													className="text-xs text-warning hover:opacity-80 disabled:opacity-40 transition-opacity"
													title="Stop the periodic sync. lastSyncAt is preserved."
												>
													{pausingId === integration.id ? "Pausing…" : "Pause sync"}
												</button>
											) : (
												<button
													type="button"
													disabled={resumingId === integration.id}
													onClick={() => handleResume(integration.id)}
													className="text-xs text-success hover:opacity-80 disabled:opacity-40 transition-opacity"
													title="Restart the periodic sync and immediately fetch data since the last sync."
												>
													{resumingId === integration.id ? "Resuming…" : "Resume sync"}
												</button>
											)}
											<button
												type="button"
												disabled={syncingId === integration.id || !integration.enabled}
												onClick={() => handleSyncNow(integration.id)}
												className="text-xs text-accent-soft hover:opacity-80 disabled:opacity-40 transition-opacity"
											>
												{syncingId === integration.id ? "Syncing…" : "Sync now"}
											</button>
											<button
												type="button"
												disabled={resettingId === integration.id}
												onClick={() => handleResetCursor(integration.id)}
												className="text-xs text-text-3 hover:text-warning disabled:opacity-40 transition-colors"
												title="Clear sync cursor — next sync will fetch from the beginning"
											>
												{resettingId === integration.id ? "Resetting…" : "Reset cursor"}
											</button>
											<button
												type="button"
												disabled={clearingDataId === integration.id}
												onClick={() => handleClearData(integration.id)}
												className="text-xs text-text-3 hover:text-warning disabled:opacity-40 transition-colors"
												title="Delete all ingested events and reset sync cursor"
											>
												{clearingDataId === integration.id ? "Clearing…" : "Delete data"}
											</button>
											<button
												type="button"
												onClick={() => openEdit(integration)}
												className="text-xs text-text-3 hover:text-text-1 transition-colors"
											>
												Edit
											</button>
											<button
												type="button"
												disabled={deletingId === integration.id}
												onClick={() => handleDelete(integration.id)}
												className="text-xs text-danger hover:opacity-80 disabled:opacity-40 transition-opacity"
											>
												{deletingId === integration.id ? "Deleting…" : "Delete"}
											</button>
										</div>
									</td>
								</tr>
							);
						})}
						{integrations.length === 0 && (
							<tr>
								<td colSpan={8} className="px-4 py-6 text-center text-text-4">
									No integrations yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
