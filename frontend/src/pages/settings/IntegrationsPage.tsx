import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { Integration } from "@/types/api";
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
	lokiQuery: '{job="claude-code"}',
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
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [syncResult, setSyncResult] = useState<Record<string, { syncedAt: string | null; error: string | null }>>({});

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

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
				<button
					type="button"
					onClick={openCreate}
					className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					Add integration
				</button>
			</div>

			{showForm && (
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-900 mb-3">
						{editingId ? "Edit integration" : "New integration"}
					</h2>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="int-name" className="block text-xs text-gray-500 mb-1">
									Name *
								</label>
								<input
									id="int-name"
									required
									value={form.name}
									onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
									placeholder="My Loki"
								/>
							</div>
							<div>
								<label htmlFor="int-url" className="block text-xs text-gray-500 mb-1">
									Loki URL *
								</label>
								<input
									id="int-url"
									required
									type="url"
									value={form.url}
									onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
									placeholder="https://loki.example.com"
								/>
							</div>
						</div>

						<div>
							<p className="text-xs text-gray-500 mb-1.5">Authentication</p>
							<div className="flex gap-4">
								{(["none", "basic"] as AuthType[]).map((val) => (
									<label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
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
									<label htmlFor="int-user" className="block text-xs text-gray-500 mb-1">
										Username
									</label>
									<input
										id="int-user"
										value={form.authUsername}
										onChange={(e) => setForm((f) => ({ ...f, authUsername: e.target.value }))}
										className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
										autoComplete="off"
									/>
								</div>
								<div>
									<label htmlFor="int-pass" className="block text-xs text-gray-500 mb-1">
										Password{editingId ? " (leave blank to keep existing)" : ""}
									</label>
									<input
										id="int-pass"
										type="password"
										value={form.authPassword}
										onChange={(e) => setForm((f) => ({ ...f, authPassword: e.target.value }))}
										className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
										placeholder={editingId ? "••••••" : ""}
										autoComplete="new-password"
									/>
								</div>
							</div>
						)}

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="int-query" className="block text-xs text-gray-500 mb-1">
									LogQL query
								</label>
								<input
									id="int-query"
									value={form.lokiQuery}
									onChange={(e) => setForm((f) => ({ ...f, lokiQuery: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm font-mono"
								/>
							</div>
							<div>
								<label htmlFor="int-interval" className="block text-xs text-gray-500 mb-1">
									Sync interval (seconds)
								</label>
								<input
									id="int-interval"
									type="number"
									min="5"
									value={form.syncIntervalSecs}
									onChange={(e) => setForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))}
									className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
								/>
							</div>
						</div>

						<label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
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
								className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
							>
								{saving ? "Saving…" : editingId ? "Update" : "Create"}
							</button>
							<button
								type="button"
								onClick={closeForm}
								className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}

			<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-gray-50 border-b border-gray-200">
						<tr>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Auth</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Interval</th>
							<th className="text-left px-4 py-3 font-medium text-gray-600">Last sync</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{integrations.map((integration) => {
							const sr = syncResult[integration.id];
							const hasError = integration.lastSyncError !== null;

							return (
								<tr key={integration.id} className={`border-b border-gray-100 ${!integration.enabled ? "opacity-50" : ""}`}>
									<td className="px-4 py-3 font-medium text-gray-900">
										{integration.name}
										{!integration.enabled && (
											<span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-500">
												disabled
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-gray-500 max-w-xs truncate">
										<span title={integration.url}>{integration.url}</span>
									</td>
									<td className="px-4 py-3 text-gray-500">
										{integration.authType === "basic" ? "Basic" : "None"}
									</td>
									<td className="px-4 py-3 text-gray-500">
										{Math.round(integration.syncIntervalMs / 1000)}s
									</td>
									<td className="px-4 py-3">
										{hasError ? (
											<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700" title={integration.lastSyncError ?? ""}>
												Error
											</span>
										) : integration.lastSyncAt ? (
											<span className="text-gray-500 text-xs">
												{formatDateTime(integration.lastSyncAt)}
											</span>
										) : (
											<span className="text-gray-400 text-xs">Never</span>
										)}
										{sr && !sr.error && (
											<span className="ml-2 text-xs text-green-600">Synced</span>
										)}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex items-center justify-end gap-3">
											<button
												type="button"
												disabled={syncingId === integration.id}
												onClick={() => handleSyncNow(integration.id)}
												className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
											>
												{syncingId === integration.id ? "Syncing…" : "Sync now"}
											</button>
											<button
												type="button"
												onClick={() => openEdit(integration)}
												className="text-xs text-gray-500 hover:text-gray-700"
											>
												Edit
											</button>
											<button
												type="button"
												disabled={deletingId === integration.id}
												onClick={() => handleDelete(integration.id)}
												className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
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
								<td colSpan={6} className="px-4 py-6 text-center text-gray-400">
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
