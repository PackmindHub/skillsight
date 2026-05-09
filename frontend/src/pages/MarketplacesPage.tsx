import { MarketplaceDetailsDrawer } from "@/components/marketplaces/MarketplaceDetailsDrawer";
import { SourceErrorBanner } from "@/components/marketplaces/SourceErrorBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusFilter } from "@/components/ui/StatusFilter";
import { useMarketplaceSourcesHealth } from "@/context/MarketplaceSourcesHealthContext";
import { api } from "@/lib/api";
import { useStatusFilter } from "@/lib/use-status-filter";
import { formatDateTime } from "@/lib/utils";
import {
	MARKETPLACE_STATUSES,
	type Marketplace,
	type MarketplaceSource,
	type MarketplaceStatus,
} from "@/types/api";
import { ExternalLink } from "lucide-react";
import {
	Fragment,
	type FormEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSearchParams } from "react-router-dom";

const STATUS_OPTIONS: { value: MarketplaceStatus; label: string }[] = [
	{ value: "to_review", label: "To Review" },
	{ value: "approved", label: "Approved" },
	{ value: "denied", label: "Denied" },
];

interface EditState {
	url: string;
	description: string;
}

interface SourceForm {
	gitUrl: string;
	accessToken: string;
	branch: string;
	syncIntervalSecs: string;
	enabled: boolean;
	importPluginsAndSkills: boolean;
}

const defaultSourceForm: SourceForm = {
	gitUrl: "",
	accessToken: "",
	branch: "",
	syncIntervalSecs: "3600",
	enabled: true,
	importPluginsAndSkills: false,
};

export default function MarketplacesPage() {
	const [items, setItems] = useState<Marketplace[]>([]);
	const [sources, setSources] = useState<MarketplaceSource[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<Record<string, EditState>>({});
	const [saving, setSaving] = useState<Record<string, boolean>>({});
	const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
	const [searchParams, setSearchParams] = useSearchParams();

	const { refresh: refreshSourcesHealth } = useMarketplaceSourcesHealth();

	const { status: statusFilter, setStatus } = useStatusFilter<MarketplaceStatus>(
		"status",
		MARKETPLACE_STATUSES,
	);
	const search = searchParams.get("search") ?? "";
	const highlightName = searchParams.get("name") ?? "";
	const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

	function clearParam(key: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.delete(key);
				return next;
			},
			{ replace: true },
		);
	}

	function updateSearch(value: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (!value) next.delete("search");
				else next.set("search", value);
				return next;
			},
			{ replace: true },
		);
	}

	// Source form state
	const [showSourceForm, setShowSourceForm] = useState(false);
	const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
	const [sourceForm, setSourceForm] = useState<SourceForm>(defaultSourceForm);
	const [savingSource, setSavingSource] = useState(false);
	const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
	const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
	const [sourceSyncResult, setSourceSyncResult] = useState<
		Record<string, { syncedAt: string | null; pluginCount: number; skillCount: number; error: string | null }>
	>({});
	const [testingConnection, setTestingConnection] = useState(false);
	const [connectionTestResult, setConnectionTestResult] = useState<
		{ ok: true; name: string; pluginCount: number } | { ok: false; error: string } | null
	>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		Promise.all([
			api.marketplaces.list().then((res) => setItems(res.marketplaces)),
			api.marketplaceSources.list().then(setSources),
		])
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	// --- Marketplace status/edit handlers ---

	async function handleStatusChange(name: string, status: MarketplaceStatus) {
		setItems((prev) => prev.map((m) => (m.name === name ? { ...m, status } : m)));
		try {
			await api.marketplaces.update(name, { status });
		} catch {
			api.marketplaces.list().then((res) => setItems(res.marketplaces)).catch(() => {});
		}
	}

	function startEdit(mp: Marketplace) {
		setEditing((prev) => ({
			...prev,
			[mp.name]: { url: mp.url ?? "", description: mp.description ?? "" },
		}));
	}

	function cancelEdit(name: string) {
		setEditing((prev) => {
			const next = { ...prev };
			delete next[name];
			return next;
		});
	}

	async function saveEdit(name: string) {
		const state = editing[name];
		if (!state) return;
		setSaving((prev) => ({ ...prev, [name]: true }));
		try {
			const updated = await api.marketplaces.update(name, {
				url: state.url.trim() || null,
				description: state.description.trim() || null,
			});
			setItems((prev) => prev.map((m) => (m.name === name ? { ...m, ...updated } : m)));
			cancelEdit(name);
		} catch (e) {
			setError(String(e));
		} finally {
			setSaving((prev) => ({ ...prev, [name]: false }));
		}
	}

	// --- Source handlers ---

	function openCreateSource() {
		setEditingSourceId(null);
		setSourceForm(defaultSourceForm);
		setConnectionTestResult(null);
		setSubmitError(null);
		setShowSourceForm(true);
	}

	function openEditSource(source: MarketplaceSource) {
		setEditingSourceId(source.id);
		setSourceForm({
			gitUrl: source.gitUrl,
			accessToken: "",
			branch: source.branch ?? "",
			syncIntervalSecs: String(Math.round(source.syncIntervalMs / 1000)),
			enabled: source.enabled,
			importPluginsAndSkills: source.importPluginsAndSkills,
		});
		setConnectionTestResult(null);
		setSubmitError(null);
		setShowSourceForm(true);
	}

	function closeSourceForm() {
		setShowSourceForm(false);
		setEditingSourceId(null);
	}

	function updateSourceField<K extends keyof SourceForm>(key: K, value: SourceForm[K]) {
		setSourceForm((f) => ({ ...f, [key]: value }));
		if (key === "gitUrl" || key === "accessToken" || key === "branch") {
			setConnectionTestResult(null);
			setSubmitError(null);
		}
	}

	async function handleTestConnection() {
		setTestingConnection(true);
		setConnectionTestResult(null);
		try {
			const result = await api.marketplaceSources.testConnection({
				gitUrl: sourceForm.gitUrl.trim(),
				accessToken: sourceForm.accessToken || null,
				branch: sourceForm.branch.trim() || null,
				sourceId: editingSourceId,
			});
			setConnectionTestResult(result);
		} catch (e) {
			setConnectionTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
		} finally {
			setTestingConnection(false);
		}
	}

	function extractErrorMessage(e: unknown): string {
		const raw = e instanceof Error ? e.message : String(e);
		try {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed.error === "string") return parsed.error;
		} catch {}
		return raw;
	}

	async function handleSourceSubmit(e: FormEvent) {
		e.preventDefault();
		setSavingSource(true);
		setSubmitError(null);
		try {
			const payload = {
				gitUrl: sourceForm.gitUrl.trim(),
				accessToken: sourceForm.accessToken || null,
				branch: sourceForm.branch.trim() || null,
				syncIntervalMs: Number(sourceForm.syncIntervalSecs) * 1000,
				enabled: sourceForm.enabled,
				importPluginsAndSkills: sourceForm.importPluginsAndSkills,
			};
			if (editingSourceId) {
				const updated = await api.marketplaceSources.update(editingSourceId, payload);
				setSources((prev) => prev.map((s) => (s.id === editingSourceId ? updated : s)));
			} else {
				const created = await api.marketplaceSources.create(payload);
				setSources((prev) => [created, ...prev]);
			}
			closeSourceForm();
			refreshSourcesHealth();
		} catch (e) {
			setSubmitError(extractErrorMessage(e));
		} finally {
			setSavingSource(false);
		}
	}

	async function handleDeleteSource(id: string) {
		setDeletingSourceId(id);
		try {
			await api.marketplaceSources.remove(id);
			setSources((prev) => prev.filter((s) => s.id !== id));
			refreshSourcesHealth();
		} finally {
			setDeletingSourceId(null);
		}
	}

	async function handleSyncSource(id: string) {
		setSyncingSourceId(id);
		try {
			const result = await api.marketplaceSources.syncNow(id);
			setSourceSyncResult((prev) => ({ ...prev, [id]: result }));
			// Refresh both marketplaces and sources to reflect new data
			await Promise.all([
				api.marketplaces.list().then((res) => setItems(res.marketplaces)),
				api.marketplaceSources.list().then(setSources),
			]);
			refreshSourcesHealth();
		} finally {
			setSyncingSourceId(null);
		}
	}

	const inputClass =
		"w-full rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright";

	const filteredItems = useMemo(() => {
		return items.filter((m) => {
			if (statusFilter !== "all" && m.status !== statusFilter) return false;
			if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		});
	}, [items, statusFilter, search]);

	useLayoutEffect(() => {
		if (!highlightName || loading) return;
		const node = highlightedRowRef.current;
		if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [highlightName, loading]);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-semibold text-text-1">Marketplaces</h1>
					<p className="text-sm text-text-3 mt-1">
						Discovered marketplaces and imported git sources. Review and approve each source.
					</p>
				</div>
				<button
					type="button"
					onClick={openCreateSource}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					Import from git
				</button>
			</div>

			{error && <p className="text-sm text-red-400">{error}</p>}

			{/* Git sources section */}
			{(sources.length > 0 || showSourceForm) && (
				<div className="space-y-3">
					<h2 className="text-sm font-medium text-text-2">Git sources</h2>

					{showSourceForm && (
						<div className="bg-surface-700 rounded-lg border border-edge p-4">
							<h3 className="text-sm font-medium text-text-1 mb-3">
								{editingSourceId ? "Edit git source" : "Import marketplace from git"}
							</h3>
							<form onSubmit={handleSourceSubmit} className="space-y-4">
								<div>
									<label htmlFor="ms-url" className="block text-xs text-text-3 mb-1">
										Repository URL *
									</label>
									<input
										id="ms-url"
										required
										value={sourceForm.gitUrl}
										onChange={(e) => updateSourceField("gitUrl", e.target.value)}
										className={inputClass}
										placeholder="owner/repo  or  https://github.com/owner/repo"
									/>
									<p className="text-xs text-text-4 mt-1">
										Accepts GitHub shorthand (owner/repo) or full GitHub / GitLab / Bitbucket HTTPS URLs.
									</p>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<label htmlFor="ms-token" className="block text-xs text-text-3 mb-1">
											Access token{editingSourceId ? " (blank = keep existing)" : ""}
										</label>
										<input
											id="ms-token"
											type="password"
											value={sourceForm.accessToken}
											onChange={(e) => updateSourceField("accessToken", e.target.value)}
											className={inputClass}
											placeholder={editingSourceId ? "••••••" : "Leave blank for public repos"}
											autoComplete="new-password"
										/>
									</div>
									<div>
										<label htmlFor="ms-branch" className="block text-xs text-text-3 mb-1">
											Branch
										</label>
										<input
											id="ms-branch"
											value={sourceForm.branch}
											onChange={(e) => updateSourceField("branch", e.target.value)}
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
											value={sourceForm.syncIntervalSecs}
											onChange={(e) => setSourceForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))}
											className={inputClass}
										/>
									</div>
								</div>

								<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
									<input
										type="checkbox"
										checked={sourceForm.enabled}
										onChange={(e) => setSourceForm((f) => ({ ...f, enabled: e.target.checked }))}
									/>
									Enable periodic sync
								</label>

								<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
									<input
										type="checkbox"
										checked={sourceForm.importPluginsAndSkills}
										onChange={(e) => setSourceForm((f) => ({ ...f, importPluginsAndSkills: e.target.checked }))}
									/>
									Import plugins and skills into registry
								</label>

								{connectionTestResult && (
									connectionTestResult.ok ? (
										<p className="text-xs text-success">
											Connected — found {connectionTestResult.pluginCount} plugin
											{connectionTestResult.pluginCount === 1 ? "" : "s"} in “
											{connectionTestResult.name}”.
										</p>
									) : (
										<p className="text-xs text-danger">{connectionTestResult.error}</p>
									)
								)}

								{submitError && <p className="text-xs text-danger">{submitError}</p>}

								<div className="flex gap-2">
									<button
										type="submit"
										disabled={savingSource}
										className="btn-primary rounded px-3 py-1.5 text-sm"
									>
										{savingSource ? "Saving…" : editingSourceId ? "Update" : "Import"}
									</button>
									<button
										type="button"
										onClick={handleTestConnection}
										disabled={testingConnection || !sourceForm.gitUrl.trim()}
										className="rounded border border-edge px-3 py-1.5 text-sm text-text-2 hover:bg-surface-800 hover:text-text-1 transition-colors disabled:opacity-40"
									>
										{testingConnection ? "Testing…" : "Test connection"}
									</button>
									<button
										type="button"
										onClick={closeSourceForm}
										className="rounded border border-edge px-3 py-1.5 text-sm text-text-3 hover:bg-surface-800 hover:text-text-1 transition-colors"
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}

					{sources.length > 0 && (
						<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
							<table className="w-full text-sm">
								<thead className="bg-surface-800 border-b border-edge">
									<tr>
										<th className="text-left px-4 py-2.5 font-medium text-text-3">Repository</th>
										<th className="text-left px-4 py-2.5 font-medium text-text-3">Marketplace</th>
										<th className="text-left px-4 py-2.5 font-medium text-text-3">Branch</th>
										<th className="text-left px-4 py-2.5 font-medium text-text-3">Last sync</th>
										<th className="px-4 py-2.5" />
									</tr>
								</thead>
								<tbody>
									{sources.map((source) => {
										const sr = sourceSyncResult[source.id];
										const hasError = source.lastSyncError !== null;
										return (
											<Fragment key={source.id}>
											<tr
												className={`border-b border-edge-dim transition-colors ${!source.enabled ? "opacity-40" : "hover:bg-surface-800"}`}
											>
												<td className="px-4 py-2.5 text-text-1">
													<div className="flex items-center gap-2">
														<a
															href={source.gitUrl}
															target="_blank"
															rel="noopener noreferrer"
															title={source.gitUrl}
															className="inline-flex items-center gap-1 font-mono text-xs truncate max-w-64 text-indigo-400 hover:text-indigo-300 hover:underline"
														>
															<span className="truncate">{source.gitUrl}</span>
															<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
														</a>
														{source.hasToken && (
															<span className="badge badge-neutral shrink-0">token</span>
														)}
													</div>
												</td>
												<td className="px-4 py-2.5 text-xs">
													{source.marketplaceName ? (
														<span className="font-medium text-text-2">{source.marketplaceName}</span>
													) : (
														<span className="text-text-4">—</span>
													)}
												</td>
												<td className="px-4 py-2.5 text-xs font-mono text-text-3">
													{source.branch || <span className="text-text-4">main</span>}
												</td>
												<td className="px-4 py-2.5">
													{hasError ? (
														<span className="badge badge-danger" title={source.lastSyncError ?? ""}>
															Error
														</span>
													) : source.lastSyncAt ? (
														<span className="text-text-3 text-xs">{formatDateTime(source.lastSyncAt)}</span>
													) : (
														<span className="text-text-4 text-xs">Never</span>
													)}
													{sr && !sr.error && (
														<span className="ml-2 text-xs text-success">
															{source.importPluginsAndSkills
																? `${sr.pluginCount} plugin${sr.pluginCount !== 1 ? "s" : ""}, ${sr.skillCount} skill${sr.skillCount !== 1 ? "s" : ""} imported`
																: `${sr.pluginCount} plugin${sr.pluginCount !== 1 ? "s" : ""}, ${sr.skillCount} skill${sr.skillCount !== 1 ? "s" : ""} available (not imported)`}
														</span>
													)}
												</td>
												<td className="px-4 py-2.5 text-right">
													<div className="flex items-center justify-end gap-3">
														<button
															type="button"
															disabled={syncingSourceId === source.id}
															onClick={() => handleSyncSource(source.id)}
															className="text-xs text-accent-soft hover:opacity-80 disabled:opacity-40 transition-opacity"
														>
															{syncingSourceId === source.id ? "Syncing…" : "Sync now"}
														</button>
														<button
															type="button"
															onClick={() => openEditSource(source)}
															className="text-xs text-text-3 hover:text-text-1 transition-colors"
														>
															Edit
														</button>
														<button
															type="button"
															disabled={deletingSourceId === source.id}
															onClick={() => handleDeleteSource(source.id)}
															className="text-xs text-danger hover:opacity-80 disabled:opacity-40 transition-opacity"
														>
															{deletingSourceId === source.id ? "Deleting…" : "Delete"}
														</button>
													</div>
												</td>
											</tr>
											{hasError && (
												<tr>
													<td colSpan={5} className="px-0 pb-3">
														<SourceErrorBanner message={source.lastSyncError ?? ""} />
													</td>
												</tr>
											)}
										</Fragment>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			{/* Discovered marketplaces section */}
			<div className="space-y-3">
				{sources.length > 0 && (
					<h2 className="text-sm font-medium text-text-2">Discovered marketplaces</h2>
				)}

				{items.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="text"
							placeholder="Search marketplace name…"
							value={search}
							onChange={(e) => updateSearch(e.target.value)}
							className="rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-1 focus:ring-accent-bright min-w-48"
						/>
						<StatusFilter<MarketplaceStatus>
							value={statusFilter}
							onChange={setStatus}
							options={MARKETPLACE_STATUSES}
						/>
						{highlightName && (
							<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
								Highlighted: {highlightName}
								<button
									type="button"
									aria-label="Clear highlight"
									onClick={() => clearParam("name")}
									className="text-text-4 hover:text-text-1"
								>
									×
								</button>
							</span>
						)}
						{filteredItems.length !== items.length && (
							<span className="text-xs text-text-4">
								{filteredItems.length} / {items.length}
							</span>
						)}
					</div>
				)}

				{items.length === 0 ? (
					<div className="bg-surface-900 border border-edge rounded-lg p-12 flex flex-col items-center gap-3 text-center">
						<div className="w-12 h-12 rounded-full bg-surface-800 border border-edge flex items-center justify-center">
							<svg className="w-6 h-6 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} role="img" aria-label="No marketplaces">
								<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
							</svg>
						</div>
						<div>
							<p className="text-sm font-medium text-text-2">No marketplaces yet</p>
							<p className="text-xs text-text-4 mt-1">
								Import a git repository above, or marketplaces appear automatically when skills are activated.
							</p>
						</div>
					</div>
				) : (
					<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
									<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
									<th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
									<th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Plugins</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Skills</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Activated</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Activations</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Activations (30d)</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Plugin installs</th>
									<th className="text-right px-4 py-3 font-medium text-gray-600">Linked skill activations</th>
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{filteredItems.length === 0 ? (
									<tr>
										<td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">
											No marketplaces match the current filters.
										</td>
									</tr>
								) : null}
								{filteredItems.map((mp) => {
									const isEditing = !!editing[mp.name];
									const isSaving = saving[mp.name] ?? false;
									const editState = editing[mp.name];
									const isHighlighted = highlightName === mp.name;
									return (
										<tr
											key={mp.name}
											ref={isHighlighted ? highlightedRowRef : undefined}
											className={
												isHighlighted
													? "border-b border-gray-100 bg-indigo-50 ring-2 ring-indigo-300"
													: "border-b border-gray-100 hover:bg-gray-50"
											}
										>
											<td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">
												<button
													type="button"
													onClick={() => setSelectedMarketplace(mp.name)}
													className="text-indigo-600 hover:underline"
													title="View marketplace details"
												>
													{mp.name}
												</button>
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<StatusBadge status={mp.status} />
													<select
														value={mp.status}
														onChange={(e) =>
															handleStatusChange(mp.name, e.target.value as MarketplaceStatus)
														}
														className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
													>
														{STATUS_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</select>
												</div>
											</td>
											<td className="px-4 py-3 text-gray-500 max-w-xs">
												{isEditing ? (
													<input
														type="url"
														value={editState.url}
														onChange={(e) =>
															setEditing((prev) => ({
																...prev,
																[mp.name]: { ...prev[mp.name], url: e.target.value },
															}))
														}
														placeholder="https://..."
														className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
													/>
												) : mp.url ? (
													<a
														href={mp.url}
														target="_blank"
														rel="noreferrer"
														className="text-indigo-600 hover:underline truncate block max-w-48"
													>
														{mp.url}
													</a>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</td>
											<td className="px-4 py-3 text-gray-500 max-w-xs">
												{isEditing ? (
													<input
														type="text"
														value={editState.description}
														onChange={(e) =>
															setEditing((prev) => ({
																...prev,
																[mp.name]: {
																	...prev[mp.name],
																	description: e.target.value,
																},
															}))
														}
														placeholder="Free description…"
														className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
													/>
												) : mp.description ? (
													<span className="truncate block max-w-56">{mp.description}</span>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</td>
											<td className="px-4 py-3 text-right text-gray-700 tabular-nums">
												{mp.pluginCount > 0 ? (
													<button
														type="button"
														onClick={() => setSelectedMarketplace(mp.name)}
														className="text-indigo-600 hover:underline"
														title="View marketplace plugins"
													>
														{mp.pluginCount}
													</button>
												) : (
													<span className="text-gray-400">0</span>
												)}
											</td>
											<td className="px-4 py-3 text-right text-gray-700 tabular-nums">
												{mp.knownSkillCount > 0 ? (
													<button
														type="button"
														onClick={() => setSelectedMarketplace(mp.name)}
														className="text-indigo-600 hover:underline"
														title="View marketplace skills"
													>
														{mp.knownSkillCount}
													</button>
												) : (
													<span className="text-gray-400">0</span>
												)}
											</td>
											<td className="px-4 py-3 text-right text-gray-700 tabular-nums">
												{mp.knownSkillCount > 0 ? (
													<button
														type="button"
														onClick={() => setSelectedMarketplace(mp.name)}
														className={
															mp.activatedSkillCount > 0
																? "text-indigo-600 hover:underline"
																: "text-gray-400 hover:underline"
														}
														title={
															mp.activatedSkillCount === 0
																? "No skill activated yet — click to inspect"
																: "View activated skills"
														}
													>
														{mp.activatedSkillCount}
													</button>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</td>
											<td className="px-4 py-3 text-right text-gray-700 tabular-nums">
												{mp.totalActivationCount}
											</td>
											<td className="px-4 py-3 text-right text-gray-700">
												{mp.activationCount}
											</td>
											<td className="px-4 py-3 text-right text-gray-700">
												{mp.pluginInstallCount > 0 ? (
													<a
														href={`/plugins?marketplace=${encodeURIComponent(mp.name)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-indigo-600 hover:underline"
													>
														{mp.pluginInstallCount}
													</a>
												) : (
													mp.pluginInstallCount
												)}
											</td>
											<td className="px-4 py-3 text-right text-gray-700">
												{mp.skillActivatedLinkedCount}
											</td>
											<td className="px-4 py-3 text-right whitespace-nowrap">
												{isEditing ? (
													<div className="flex items-center justify-end gap-2">
														<button
															type="button"
															onClick={() => saveEdit(mp.name)}
															disabled={isSaving}
															className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
														>
															{isSaving ? "Saving…" : "Save"}
														</button>
														<button
															type="button"
															onClick={() => cancelEdit(mp.name)}
															className="text-xs text-gray-500 hover:text-gray-700"
														>
															Cancel
														</button>
													</div>
												) : (
													<button
														type="button"
														onClick={() => startEdit(mp)}
														className="text-xs text-gray-500 hover:text-gray-700"
													>
														Edit
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<MarketplaceDetailsDrawer
				marketplaceName={selectedMarketplace}
				onClose={() => setSelectedMarketplace(null)}
			/>
		</div>
	);
}
