import { MarketplaceDetailsDrawer } from "@/components/marketplaces/MarketplaceDetailsDrawer";
import { SourceErrorBanner } from "@/components/marketplaces/SourceErrorBanner";
import {
	Button,
	Card,
	EmptyRow,
	FormField,
	Input,
	PageHeader,
	Select,
	StatusBadge,
	StatusFilter,
	TBody,
	TD,
	TH,
	THead,
	TR,
	Table,
} from "@/components/ui";
import { useMarketplaceSourcesHealth } from "@/context/MarketplaceSourcesHealthContext";
import { api } from "@/lib/api";
import { useStatusFilter } from "@/lib/use-status-filter";
import { cn, formatDateTime } from "@/lib/utils";
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
		| { ok: true; name: string; pluginCount: number; skillCount: number }
		| { ok: false; error: string }
		| null
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
				const { firstSync, ...created } = await api.marketplaceSources.create(payload);
				setSources((prev) => [created, ...prev]);
				if (firstSync) {
					setSourceSyncResult((prev) => ({
						...prev,
						[created.id]: {
							syncedAt: created.lastSyncAt,
							pluginCount: firstSync.pluginCount,
							skillCount: firstSync.skillCount,
							error: firstSync.error,
						},
					}));
					if (firstSync.error) {
						setSubmitError(firstSync.error);
						setSavingSource(false);
						return;
					}
				}
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
			await Promise.all([
				api.marketplaces.list().then((res) => setItems(res.marketplaces)),
				api.marketplaceSources.list().then(setSources),
			]);
			refreshSourcesHealth();
		} finally {
			setSyncingSourceId(null);
		}
	}

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
			<PageHeader
				title="Marketplaces"
				subtitle="Discovered marketplaces and imported git sources. Review and approve each source."
				actions={<Button onClick={openCreateSource}>Import from git</Button>}
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			{(sources.length > 0 || showSourceForm) && (
				<div className="space-y-3">
					<h2 className="text-sm font-medium text-text-2">Git sources</h2>

					{showSourceForm && (
						<Card surface="raised">
							<h3 className="text-sm font-medium text-text-1 mb-3">
								{editingSourceId ? "Edit git source" : "Import marketplace from git"}
							</h3>
							<form onSubmit={handleSourceSubmit} className="space-y-4">
								<FormField
									label="Repository URL"
									htmlFor="ms-url"
									required
									helper="Accepts GitHub shorthand (owner/repo) or full GitHub / GitLab / Bitbucket HTTPS URLs."
								>
									<Input
										id="ms-url"
										required
										size="sm"
										value={sourceForm.gitUrl}
										onChange={(e) => updateSourceField("gitUrl", e.target.value)}
										placeholder="owner/repo  or  https://github.com/owner/repo"
									/>
								</FormField>

								<div className="grid grid-cols-2 gap-3">
									<FormField
										label={`Access token${editingSourceId ? " (blank = keep existing)" : ""}`}
										htmlFor="ms-token"
									>
										<Input
											id="ms-token"
											type="password"
											size="sm"
											value={sourceForm.accessToken}
											onChange={(e) => updateSourceField("accessToken", e.target.value)}
											placeholder={editingSourceId ? "••••••" : "Leave blank for public repos"}
											autoComplete="new-password"
										/>
									</FormField>
									<FormField label="Branch" htmlFor="ms-branch">
										<Input
											id="ms-branch"
											size="sm"
											value={sourceForm.branch}
											onChange={(e) => updateSourceField("branch", e.target.value)}
											placeholder="main"
										/>
									</FormField>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<FormField
										label="Sync interval (seconds, min 60)"
										htmlFor="ms-interval"
									>
										<Input
											id="ms-interval"
											type="number"
											min="60"
											size="sm"
											value={sourceForm.syncIntervalSecs}
											onChange={(e) => setSourceForm((f) => ({ ...f, syncIntervalSecs: e.target.value }))}
										/>
									</FormField>
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

								{connectionTestResult &&
									(connectionTestResult.ok ? (
										<p className="text-xs text-success">
											Connected — found {connectionTestResult.pluginCount} plugin
											{connectionTestResult.pluginCount === 1 ? "" : "s"} and{" "}
											{connectionTestResult.skillCount} skill
											{connectionTestResult.skillCount === 1 ? "" : "s"} in “
											{connectionTestResult.name}”.
										</p>
									) : (
										<p className="text-xs text-danger">{connectionTestResult.error}</p>
									))}

								{submitError && <p className="text-xs text-danger">{submitError}</p>}

								<div className="flex gap-2">
									<Button type="submit" size="sm" loading={savingSource}>
										{editingSourceId ? "Update" : "Import"}
									</Button>
									<Button
										variant="secondary"
										size="sm"
										onClick={handleTestConnection}
										disabled={!sourceForm.gitUrl.trim()}
										loading={testingConnection}
									>
										Test connection
									</Button>
									<Button variant="secondary" size="sm" onClick={closeSourceForm}>
										Cancel
									</Button>
								</div>
							</form>
						</Card>
					)}

					{sources.length > 0 && (
						<Table>
							<THead>
								<TR>
									<TH>Repository</TH>
									<TH>Marketplace</TH>
									<TH>Branch</TH>
									<TH>Last sync</TH>
									<TH align="right">{""}</TH>
								</TR>
							</THead>
							<TBody>
								{sources.map((source) => {
									const sr = sourceSyncResult[source.id];
									const hasError = source.lastSyncError !== null;
									return (
										<Fragment key={source.id}>
											<TR className={!source.enabled ? "opacity-40" : undefined}>
												<TD>
													<div className="flex items-center gap-2">
														<a
															href={source.gitUrl}
															target="_blank"
															rel="noopener noreferrer"
															title={source.gitUrl}
															className="inline-flex items-center gap-1 font-mono text-xs truncate max-w-64 text-accent-soft hover:text-accent-bright hover:underline"
														>
															<span className="truncate">{source.gitUrl}</span>
															<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
														</a>
														{source.hasToken && (
															<span className="badge badge-neutral shrink-0">token</span>
														)}
													</div>
												</TD>
												<TD className="text-xs">
													{source.marketplaceName ? (
														<span className="font-medium text-text-2">
															{source.marketplaceName}
														</span>
													) : (
														<span className="text-text-4">—</span>
													)}
												</TD>
												<TD className="text-xs font-mono text-text-3">
													{source.branch || <span className="text-text-4">main</span>}
												</TD>
												<TD>
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
															{source.importPluginsAndSkills
																? `${sr.pluginCount} plugin${sr.pluginCount !== 1 ? "s" : ""}, ${sr.skillCount} skill${sr.skillCount !== 1 ? "s" : ""} imported`
																: `${sr.pluginCount} plugin${sr.pluginCount !== 1 ? "s" : ""}, ${sr.skillCount} skill${sr.skillCount !== 1 ? "s" : ""} available (not imported)`}
														</span>
													)}
												</TD>
												<TD align="right">
													<div className="flex items-center justify-end gap-3">
														<Button
															variant="ghost"
															size="sm"
															loading={syncingSourceId === source.id}
															onClick={() => handleSyncSource(source.id)}
															className="text-accent-soft hover:text-accent-bright"
														>
															Sync now
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => openEditSource(source)}
														>
															Edit
														</Button>
														<Button
															variant="ghost"
															size="sm"
															loading={deletingSourceId === source.id}
															onClick={() => handleDeleteSource(source.id)}
															className="text-danger hover:text-danger"
														>
															Delete
														</Button>
													</div>
												</TD>
											</TR>
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
							</TBody>
						</Table>
					)}
				</div>
			)}

			<div className="space-y-3">
				{sources.length > 0 && (
					<h2 className="text-sm font-medium text-text-2">Discovered marketplaces</h2>
				)}

				{items.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						<Input
							size="sm"
							placeholder="Search marketplace name…"
							value={search}
							onChange={(e) => updateSearch(e.target.value)}
							className="min-w-48"
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
					<Card padding="lg" className="flex flex-col items-center gap-3 text-center py-12">
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
					</Card>
				) : (
					<Table>
						<THead>
							<TR>
								<TH>Name</TH>
								<TH>Status</TH>
								<TH>URL</TH>
								<TH>Description</TH>
								<TH align="right">Plugins</TH>
								<TH align="right">Skills</TH>
								<TH align="right">Activated</TH>
								<TH align="right">Activations</TH>
								<TH align="right">Activations (30d)</TH>
								<TH align="right">Plugin installs</TH>
								<TH align="right">Linked skill activations</TH>
								<TH align="right">{""}</TH>
							</TR>
						</THead>
						<TBody>
							{filteredItems.length === 0 && (
								<EmptyRow colSpan={12}>No marketplaces match the current filters.</EmptyRow>
							)}
							{filteredItems.map((mp) => {
								const isEditing = !!editing[mp.name];
								const isSaving = saving[mp.name] ?? false;
								const editState = editing[mp.name];
								const isHighlighted = highlightName === mp.name;
								return (
									<TR
										key={mp.name}
										ref={isHighlighted ? highlightedRowRef : undefined}
										highlighted={isHighlighted}
									>
										<TD className="font-mono whitespace-nowrap">
											<button
												type="button"
												onClick={() => setSelectedMarketplace(mp.name)}
												className="text-accent-soft hover:underline"
												title="View marketplace details"
											>
												{mp.name}
											</button>
										</TD>
										<TD>
											<div className="flex items-center gap-2">
												<StatusBadge status={mp.status} />
												<Select
													size="sm"
													value={mp.status}
													onChange={(e) =>
														handleStatusChange(mp.name, e.target.value as MarketplaceStatus)
													}
												>
													{STATUS_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</Select>
											</div>
										</TD>
										<TD className="text-text-3 max-w-xs">
											{isEditing ? (
												<Input
													type="url"
													size="sm"
													value={editState.url}
													onChange={(e) =>
														setEditing((prev) => ({
															...prev,
															[mp.name]: { ...prev[mp.name], url: e.target.value },
														}))
													}
													placeholder="https://..."
												/>
											) : mp.url ? (
												<a
													href={mp.url}
													target="_blank"
													rel="noreferrer"
													className="text-accent-soft hover:underline truncate block max-w-48"
												>
													{mp.url}
												</a>
											) : (
												<span className="text-text-4">—</span>
											)}
										</TD>
										<TD className="text-text-3 max-w-xs">
											{isEditing ? (
												<Input
													type="text"
													size="sm"
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
												/>
											) : mp.description ? (
												<span className="truncate block max-w-56">{mp.description}</span>
											) : (
												<span className="text-text-4">—</span>
											)}
										</TD>
										<TD numeric>
											{mp.pluginCount > 0 ? (
												<button
													type="button"
													onClick={() => setSelectedMarketplace(mp.name)}
													className="text-accent-soft hover:underline"
													title="View marketplace plugins"
												>
													{mp.pluginCount}
												</button>
											) : (
												<span className="text-text-4">0</span>
											)}
										</TD>
										<TD numeric>
											{mp.knownSkillCount > 0 ? (
												<button
													type="button"
													onClick={() => setSelectedMarketplace(mp.name)}
													className="text-accent-soft hover:underline"
													title="View marketplace skills"
												>
													{mp.knownSkillCount}
												</button>
											) : (
												<span className="text-text-4">0</span>
											)}
										</TD>
										<TD numeric>
											{mp.knownSkillCount > 0 ? (
												<button
													type="button"
													onClick={() => setSelectedMarketplace(mp.name)}
													className={cn(
														"hover:underline",
														mp.activatedSkillCount > 0
															? "text-accent-soft"
															: "text-text-4",
													)}
													title={
														mp.activatedSkillCount === 0
															? "No skill activated yet — click to inspect"
															: "View activated skills"
													}
												>
													{mp.activatedSkillCount}
												</button>
											) : (
												<span className="text-text-4">—</span>
											)}
										</TD>
										<TD numeric>{mp.totalActivationCount}</TD>
										<TD numeric>{mp.activationCount}</TD>
										<TD numeric>
											{mp.pluginInstallCount > 0 ? (
												<a
													href={`/plugins?marketplace=${encodeURIComponent(mp.name)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="text-accent-soft hover:underline"
												>
													{mp.pluginInstallCount}
												</a>
											) : (
												mp.pluginInstallCount
											)}
										</TD>
										<TD numeric>{mp.skillActivatedLinkedCount}</TD>
										<TD align="right" className="whitespace-nowrap">
											{isEditing ? (
												<div className="flex items-center justify-end gap-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => saveEdit(mp.name)}
														loading={isSaving}
													>
														Save
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => cancelEdit(mp.name)}
													>
														Cancel
													</Button>
												</div>
											) : (
												<Button variant="ghost" size="sm" onClick={() => startEdit(mp)}>
													Edit
												</Button>
											)}
										</TD>
									</TR>
								);
							})}
						</TBody>
					</Table>
				)}
			</div>

			<MarketplaceDetailsDrawer
				marketplaceName={selectedMarketplace}
				onClose={() => setSelectedMarketplace(null)}
			/>
		</div>
	);
}
