import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { MarketplaceSource } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

interface FormState {
	gitUrl: string;
	accessToken: string;
	branch: string;
	syncIntervalSecs: string;
	enabled: boolean;
}

const defaultForm: FormState = {
	gitUrl: "",
	accessToken: "",
	branch: "",
	syncIntervalSecs: "3600",
	enabled: true,
};

export default function MarketplaceSourcesPage() {
	const [sources, setSources] = useState<MarketplaceSource[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<FormState>(defaultForm);
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [syncingId, setSyncingId] = useState<string | null>(null);
	const [syncResult, setSyncResult] = useState<
		Record<string, { syncedAt: string | null; pluginCount: number; error: string | null }>
	>({});

	useEffect(() => {
		api.marketplaceSources
			.list()
			.then(setSources)
			.finally(() => setLoading(false));
	}, []);

	function openCreate() {
		setEditingId(null);
		setForm(defaultForm);
		setShowForm(true);
	}

	function openEdit(source: MarketplaceSource) {
		setEditingId(source.id);
		setForm({
			gitUrl: source.gitUrl,
			accessToken: "",
			branch: source.branch ?? "",
			syncIntervalSecs: String(Math.round(source.syncIntervalMs / 1000)),
			enabled: source.enabled,
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
				gitUrl: form.gitUrl.trim(),
				accessToken: form.accessToken || null,
				branch: form.branch.trim() || null,
				syncIntervalMs: Number(form.syncIntervalSecs) * 1000,
				enabled: form.enabled,
			};

			if (editingId) {
				const updated = await api.marketplaceSources.update(editingId, payload);
				setSources((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
			} else {
				const created = await api.marketplaceSources.create(payload);
				setSources((prev) => [created, ...prev]);
			}
			closeForm();
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		setDeletingId(id);
		try {
			await api.marketplaceSources.remove(id);
			setSources((prev) => prev.filter((s) => s.id !== id));
		} finally {
			setDeletingId(null);
		}
	}

	async function handleSyncNow(id: string) {
		setSyncingId(id);
		try {
			const result = await api.marketplaceSources.syncNow(id);
			setSyncResult((prev) => ({ ...prev, [id]: result }));
			setSources((prev) =>
				prev.map((s) =>
					s.id === id
						? {
								...s,
								lastSyncAt: result.syncedAt,
								lastSyncError: result.error,
								marketplaceName: s.marketplaceName,
							}
						: s,
				),
			);
			// refresh list to get updated marketplaceName
			api.marketplaceSources.list().then(setSources).catch(() => {});
		} finally {
			setSyncingId(null);
		}
	}

	const inputClass =
		"w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright";

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold text-text-1">Marketplace Sources</h1>
					<p className="text-xs text-text-4 mt-0.5">
						Import plugin marketplaces from git repositories. Plugins are synced on a schedule.
					</p>
				</div>
				<button
					type="button"
					onClick={openCreate}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					Add source
				</button>
			</div>

			{showForm && (
				<div className="bg-surface-700 rounded-lg border border-edge p-4">
					<h2 className="text-sm font-medium text-text-1 mb-3">
						{editingId ? "Edit marketplace source" : "New marketplace source"}
					</h2>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="ms-url" className="block text-xs text-text-3 mb-1">
								Git repository URL *
							</label>
							<input
								id="ms-url"
								required
								value={form.gitUrl}
								onChange={(e) => setForm((f) => ({ ...f, gitUrl: e.target.value }))}
								className={inputClass}
								placeholder="owner/repo  or  https://github.com/owner/repo"
							/>
							<p className="text-xs text-text-4 mt-1">
								Accepts GitHub shorthand (owner/repo), GitHub/GitLab/Bitbucket HTTPS URLs.
							</p>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="ms-token" className="block text-xs text-text-3 mb-1">
									Access token{editingId ? " (leave blank to keep existing)" : ""}
								</label>
								<input
									id="ms-token"
									type="password"
									value={form.accessToken}
									onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
									className={inputClass}
									placeholder={editingId ? "••••••" : "Leave blank for public repos"}
									autoComplete="new-password"
								/>
							</div>
							<div>
								<label htmlFor="ms-branch" className="block text-xs text-text-3 mb-1">
									Branch
								</label>
								<input
									id="ms-branch"
									value={form.branch}
									onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
									className={inputClass}
									placeholder="main"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label htmlFor="ms-interval" className="block text-xs text-text-3 mb-1">
									Sync interval (seconds, min 60)
								</label>
								<input
									id="ms-interval"
									type="number"
									min="60"
									value={form.syncIntervalSecs}
									onChange={(e) => setForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))}
									className={inputClass}
								/>
							</div>
						</div>

						<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
							<input
								type="checkbox"
								checked={form.enabled}
								onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
							/>
							Enable periodic sync
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
							<th className="text-left px-4 py-3 font-medium text-text-3">Repository</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Marketplace</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Branch</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Interval</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Last sync</th>
							<th className="px-4 py-3" />
						</tr>
					</thead>
					<tbody>
						{sources.map((source) => {
							const sr = syncResult[source.id];
							const hasError = source.lastSyncError !== null;

							return (
								<tr
									key={source.id}
									className={`border-b border-edge-dim transition-colors ${!source.enabled ? "opacity-40" : "hover:bg-surface-800"}`}
								>
									<td className="px-4 py-3 text-text-1 max-w-xs">
										<div className="flex items-center gap-2 truncate">
											<span className="font-mono text-xs truncate" title={source.gitUrl}>
												{source.gitUrl}
											</span>
											{source.hasToken && (
												<span className="badge badge-neutral shrink-0">token</span>
											)}
											{!source.enabled && (
												<span className="badge badge-neutral shrink-0">disabled</span>
											)}
										</div>
									</td>
									<td className="px-4 py-3 text-text-3 text-xs">
										{source.marketplaceName ? (
											<span className="font-medium text-text-2">{source.marketplaceName}</span>
										) : (
											<span className="text-text-4">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-text-3 text-xs font-mono">
										{source.branch || <span className="text-text-4">main</span>}
									</td>
									<td className="px-4 py-3 text-text-3">
										{Math.round(source.syncIntervalMs / 1000)}s
									</td>
									<td className="px-4 py-3">
										{hasError ? (
											<span className="badge badge-danger" title={source.lastSyncError ?? ""}>
												Error
											</span>
										) : source.lastSyncAt ? (
											<span className="text-text-3 text-xs">
												{formatDateTime(source.lastSyncAt)}
											</span>
										) : (
											<span className="text-text-4 text-xs">Never</span>
										)}
										{sr && !sr.error && (
											<span className="ml-2 text-xs text-success">
												{sr.pluginCount} plugin{sr.pluginCount !== 1 ? "s" : ""} synced
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex items-center justify-end gap-3">
											<button
												type="button"
												disabled={syncingId === source.id}
												onClick={() => handleSyncNow(source.id)}
												className="text-xs text-accent-soft hover:opacity-80 disabled:opacity-40 transition-opacity"
											>
												{syncingId === source.id ? "Syncing…" : "Sync now"}
											</button>
											<button
												type="button"
												onClick={() => openEdit(source)}
												className="text-xs text-text-3 hover:text-text-1 transition-colors"
											>
												Edit
											</button>
											<button
												type="button"
												disabled={deletingId === source.id}
												onClick={() => handleDelete(source.id)}
												className="text-xs text-danger hover:opacity-80 disabled:opacity-40 transition-opacity"
											>
												{deletingId === source.id ? "Deleting…" : "Delete"}
											</button>
										</div>
									</td>
								</tr>
							);
						})}
						{sources.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center">
									<p className="text-text-4 text-sm">No marketplace sources yet.</p>
									<p className="text-text-4 text-xs mt-1">
										Add a git repository to import plugins from a marketplace.
									</p>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
