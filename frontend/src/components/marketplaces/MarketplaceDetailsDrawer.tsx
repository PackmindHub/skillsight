import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { Drawer } from "@/components/ui/Drawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import type {
	Marketplace,
	MarketplaceDetailResponse,
	MarketplaceSource,
} from "@/types/api";
import { ExternalLink } from "lucide-react";

interface MarketplaceDetailsDrawerProps {
	marketplace: Marketplace | null;
	linkedSources: MarketplaceSource[];
	initialMode?: "view" | "edit";
	onClose: () => void;
	onChanged: () => void;
	onRequestImport: (marketplaceName: string) => void;
}

interface MetadataForm {
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

function metadataFromMarketplace(mp: Marketplace): MetadataForm {
	return { url: mp.url ?? "", description: mp.description ?? "" };
}

function sourceFormFromSource(source: MarketplaceSource): SourceForm {
	return {
		gitUrl: source.gitUrl,
		accessToken: "",
		branch: source.branch ?? "",
		syncIntervalSecs: String(Math.round(source.syncIntervalMs / 1000)),
		enabled: source.enabled,
		importPluginsAndSkills: source.importPluginsAndSkills,
	};
}

function extractErrorMessage(e: unknown): string {
	const raw = e instanceof Error ? e.message : String(e);
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed.error === "string") return parsed.error;
	} catch {}
	return raw;
}

export function MarketplaceDetailsDrawer({
	marketplace,
	linkedSources,
	initialMode = "view",
	onClose,
	onChanged,
	onRequestImport,
}: MarketplaceDetailsDrawerProps) {
	const marketplaceName = marketplace?.name ?? null;
	const [detail, setDetail] = useState<MarketplaceDetailResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<"view" | "edit">(initialMode);
	const [metadata, setMetadata] = useState<MetadataForm>({ url: "", description: "" });
	const editableSource = linkedSources.length === 1 ? linkedSources[0] : null;
	const [sourceForm, setSourceForm] = useState<SourceForm | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);
	const [syncResult, setSyncResult] = useState<
		| { kind: "ok"; pluginCount: number; skillCount: number; syncedAt: string | null }
		| { kind: "err"; message: string }
		| null
	>(null);
	const lastInitializedName = useRef<string | null>(null);

	useEffect(() => {
		if (!marketplaceName) {
			setDetail(null);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		api.marketplaces
			.detail(marketplaceName)
			.then((res) => {
				if (!cancelled) setDetail(res);
			})
			.catch((e) => {
				if (!cancelled) setError(String(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [marketplaceName]);

	useEffect(() => {
		if (!marketplace) {
			lastInitializedName.current = null;
			setMetadata({ url: "", description: "" });
			setSourceForm(null);
			setSaveError(null);
			return;
		}
		if (lastInitializedName.current === marketplace.name) return;
		lastInitializedName.current = marketplace.name;
		setMode(initialMode);
		setMetadata(metadataFromMarketplace(marketplace));
		setSourceForm(editableSource ? sourceFormFromSource(editableSource) : null);
		setSaveError(null);
		setSyncResult(null);
		setSyncing(false);
	}, [marketplace, initialMode, editableSource]);

	function enterEdit() {
		if (!marketplace) return;
		setMetadata(metadataFromMarketplace(marketplace));
		setSourceForm(editableSource ? sourceFormFromSource(editableSource) : null);
		setSaveError(null);
		setSyncResult(null);
		setMode("edit");
	}

	function cancelEdit() {
		if (!marketplace) return;
		setMetadata(metadataFromMarketplace(marketplace));
		setSourceForm(editableSource ? sourceFormFromSource(editableSource) : null);
		setSaveError(null);
		setSyncResult(null);
		setMode("view");
	}

	async function handleSave(e: FormEvent) {
		e.preventDefault();
		if (!marketplace) return;
		setSaving(true);
		setSaveError(null);
		try {
			const nextUrl = metadata.url.trim() || null;
			const nextDescription = metadata.description.trim() || null;
			const metadataChanged =
				nextUrl !== (marketplace.url ?? null) ||
				nextDescription !== (marketplace.description ?? null);

			const ops: Promise<unknown>[] = [];
			if (metadataChanged) {
				ops.push(
					api.marketplaces.update(marketplace.name, {
						url: nextUrl,
						description: nextDescription,
					}),
				);
			}

			if (editableSource && sourceForm) {
				ops.push(
					api.marketplaceSources.update(editableSource.id, {
						gitUrl: sourceForm.gitUrl.trim(),
						accessToken: sourceForm.accessToken ? sourceForm.accessToken : null,
						branch: sourceForm.branch.trim() || null,
						syncIntervalMs: Number(sourceForm.syncIntervalSecs) * 1000,
						enabled: sourceForm.enabled,
						importPluginsAndSkills: sourceForm.importPluginsAndSkills,
					}),
				);
			}

			await Promise.all(ops);
			onChanged();
			setSyncResult(null);
			setMode("view");
		} catch (err) {
			setSaveError(extractErrorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	async function handleSyncNow() {
		if (!editableSource) return;
		setSyncing(true);
		setSyncResult(null);
		try {
			const res = await api.marketplaceSources.syncNow(editableSource.id);
			if (res.error) {
				setSyncResult({ kind: "err", message: res.error });
			} else {
				setSyncResult({
					kind: "ok",
					pluginCount: res.pluginCount,
					skillCount: res.skillCount,
					syncedAt: res.syncedAt,
				});
				onChanged();
			}
		} catch (e) {
			setSyncResult({ kind: "err", message: extractErrorMessage(e) });
		} finally {
			setSyncing(false);
		}
	}

	const sourceDirty = (() => {
		if (!editableSource || !sourceForm) return false;
		const persisted = sourceFormFromSource(editableSource);
		return (
			sourceForm.gitUrl !== persisted.gitUrl ||
			sourceForm.branch !== persisted.branch ||
			sourceForm.syncIntervalSecs !== persisted.syncIntervalSecs ||
			sourceForm.enabled !== persisted.enabled ||
			sourceForm.importPluginsAndSkills !== persisted.importPluginsAndSkills ||
			sourceForm.accessToken !== ""
		);
	})();

	const plugins = detail?.plugins ?? [];
	const skills = detail?.skills ?? [];
	const totalActivations = skills.reduce((sum, s) => sum + s.activationCount, 0);
	const activatedSkillCount = skills.filter((s) => s.activationCount > 0).length;
	const isEditing = mode === "edit";

	const footer = marketplace ? (
		isEditing ? (
			<div className="flex items-center justify-between gap-2">
				{saveError ? (
					<p className="text-xs text-danger truncate">{saveError}</p>
				) : (
					<span />
				)}
				<div className="flex items-center gap-2">
					<Button variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>
						Cancel
					</Button>
					<Button
						type="submit"
						form="marketplace-edit-form"
						size="sm"
						loading={saving}
					>
						Save
					</Button>
				</div>
			</div>
		) : (
			<div className="flex items-center justify-end">
				<Button size="sm" onClick={enterEdit}>
					Edit
				</Button>
			</div>
		)
	) : null;

	return (
		<Drawer
			open={marketplaceName !== null}
			onClose={onClose}
			title={marketplaceName ?? "Marketplace"}
			widthClass="w-[560px]"
			footer={footer}
		>
			{loading && <p className="text-sm text-text-3">Loading…</p>}
			{error && <p className="text-sm text-danger">{error}</p>}
			{!loading && !error && marketplace && (
				<div className="space-y-5">
					{isEditing ? (
						<form id="marketplace-edit-form" onSubmit={handleSave} className="space-y-5">
							<section className="space-y-3">
								<h3 className="text-xs uppercase tracking-wide text-text-4">
									Marketplace
								</h3>
								<FormField label="URL" htmlFor="mp-url">
									<Input
										id="mp-url"
										type="url"
										size="sm"
										value={metadata.url}
										onChange={(e) =>
											setMetadata((m) => ({ ...m, url: e.target.value }))
										}
										placeholder="https://..."
									/>
								</FormField>
								<FormField label="Description" htmlFor="mp-description">
									<Input
										id="mp-description"
										type="text"
										size="sm"
										value={metadata.description}
										onChange={(e) =>
											setMetadata((m) => ({ ...m, description: e.target.value }))
										}
										placeholder="Free description…"
									/>
								</FormField>
							</section>

							<section className="space-y-3">
								<h3 className="text-xs uppercase tracking-wide text-text-4">
									Git source
								</h3>
								{linkedSources.length === 0 && (
									<div className="rounded border border-edge-dim bg-surface-800 px-3 py-3 text-sm text-text-3 space-y-2">
										<p>No git source is linked to this marketplace.</p>
										<p className="text-xs text-text-4">
											Import a repository — the source will link to{" "}
											<span className="font-mono">{marketplace.name}</span>{" "}
											automatically if its <span className="font-mono">marketplace.json</span> declares this name.
										</p>
										<Button
											variant="secondary"
											size="sm"
											onClick={() => onRequestImport(marketplace.name)}
										>
											Import from git
										</Button>
									</div>
								)}
								{linkedSources.length > 1 && (
									<div className="rounded border border-edge-dim bg-surface-800 px-3 py-3 text-sm text-text-3 space-y-2">
										<p>
											Multiple git sources are linked to this marketplace. Manage
											each from the Git sources table.
										</p>
										<ul className="space-y-1">
											{linkedSources.map((s) => (
												<li key={s.id} className="font-mono text-xs text-text-2 truncate">
													{s.gitUrl}
												</li>
											))}
										</ul>
									</div>
								)}
								{editableSource && sourceForm && (
									<>
										<FormField
											label="Repository URL"
											htmlFor="ms-url"
											helper="Accepts GitHub shorthand (owner/repo) or full HTTPS URLs."
										>
											<Input
												id="ms-url"
												required
												size="sm"
												value={sourceForm.gitUrl}
												onChange={(e) =>
													setSourceForm((f) =>
														f ? { ...f, gitUrl: e.target.value } : f,
													)
												}
												placeholder="owner/repo  or  https://github.com/owner/repo"
											/>
										</FormField>
										<div className="grid grid-cols-2 gap-3">
											<FormField label="Branch" htmlFor="ms-branch">
												<Input
													id="ms-branch"
													size="sm"
													value={sourceForm.branch}
													onChange={(e) =>
														setSourceForm((f) =>
															f ? { ...f, branch: e.target.value } : f,
														)
													}
													placeholder="main"
												/>
											</FormField>
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
													onChange={(e) =>
														setSourceForm((f) =>
															f ? { ...f, syncIntervalSecs: e.target.value } : f,
														)
													}
												/>
											</FormField>
										</div>
										<FormField
											label="Access token (blank = keep existing)"
											htmlFor="ms-token"
											helper="Leave blank for public repositories."
										>
											<Input
												id="ms-token"
												type="password"
												size="sm"
												value={sourceForm.accessToken}
												onChange={(e) =>
													setSourceForm((f) =>
														f ? { ...f, accessToken: e.target.value } : f,
													)
												}
												placeholder={editableSource.hasToken ? "••••••" : ""}
												autoComplete="new-password"
											/>
										</FormField>
										<div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
											<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
												<input
													type="checkbox"
													className="h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
													checked={sourceForm.enabled}
													onChange={(e) =>
														setSourceForm((f) =>
															f ? { ...f, enabled: e.target.checked } : f,
														)
													}
												/>
												Enable periodic sync
											</label>
											<label className="flex items-center gap-2 text-sm text-text-2 cursor-pointer">
												<input
													type="checkbox"
													className="h-4 w-4 rounded border-edge bg-surface-800 accent-accent-bright"
													checked={sourceForm.importPluginsAndSkills}
													onChange={(e) =>
														setSourceForm((f) =>
															f
																? { ...f, importPluginsAndSkills: e.target.checked }
																: f,
														)
													}
												/>
												Import plugins and skills into registry
											</label>
										</div>
										<div className="flex flex-col gap-1 pt-3 border-t border-edge-dim">
											<div className="flex items-center gap-3">
												<Button
													type="button"
													variant="secondary"
													size="sm"
													onClick={handleSyncNow}
													disabled={syncing || saving || sourceDirty}
													loading={syncing}
												>
													Sync now
												</Button>
												{sourceDirty && !syncing && (
													<span className="text-xs text-text-4">
														Save changes first
													</span>
												)}
											</div>
											{syncResult?.kind === "ok" && (
												<p className="text-xs text-text-3">
													Synced — {syncResult.pluginCount} plugin
													{syncResult.pluginCount === 1 ? "" : "s"},{" "}
													{syncResult.skillCount} skill
													{syncResult.skillCount === 1 ? "" : "s"}.
												</p>
											)}
											{syncResult?.kind === "err" && (
												<p className="text-xs text-danger">
													{syncResult.message}
												</p>
											)}
										</div>
									</>
								)}
							</section>
						</form>
					) : (
						<MarketplaceSummary
							marketplace={marketplace}
							linkedSources={linkedSources}
						/>
					)}

					<div className="grid grid-cols-4 gap-3">
						<Stat label="Plugins" value={plugins.length} />
						<Stat label="Skills" value={skills.length} />
						<Stat
							label="Activated"
							value={activatedSkillCount}
							muted={activatedSkillCount === 0}
						/>
						<Stat
							label="Activations"
							value={totalActivations}
							muted={totalActivations === 0}
						/>
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Plugins (sorted by activations)
						</p>
						{plugins.length === 0 ? (
							<p className="text-sm text-text-4">No plugins linked to this marketplace.</p>
						) : (
							<ul className="space-y-1">
								{plugins.map((p) => {
									const isUnused = p.skillActivationCount === 0;
									return (
										<li
											key={p.pluginName}
											className={`flex items-center justify-between gap-2 rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm ${
												isUnused ? "opacity-60" : ""
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												<a
													href={`/plugins?name=${encodeURIComponent(p.pluginName)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-mono text-text-2 truncate hover:text-accent-bright hover:underline"
													title={`Open plugin ${p.pluginName} in a new tab`}
												>
													{p.pluginName}
												</a>
												<StatusBadge status={p.status} />
												{p.pluginVersion && (
													<span className="text-xs text-text-4 font-mono">
														{p.pluginVersion}
													</span>
												)}
											</div>
											<div className="flex items-center gap-3 shrink-0 tabular-nums">
												<span
													className="text-xs text-text-4"
													title="Installations"
												>
													{p.installationCount} inst.
												</span>
												<span
													className={`font-medium ${
														isUnused ? "text-text-4" : "text-text-1"
													}`}
													title="Skill activations"
												>
													{p.skillActivationCount}
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>

					<div className="space-y-2">
						<p className="text-xs uppercase tracking-wide text-text-4">
							Skills (sorted by activations)
						</p>
						{skills.length === 0 ? (
							<p className="text-sm text-text-4">No skills declared for this marketplace.</p>
						) : (
							<ul className="space-y-1">
								{skills.map((s) => {
									const isUnused = s.activationCount === 0;
									return (
										<li
											key={`${s.pluginName}::${s.skillName}`}
											className={`flex items-center justify-between gap-2 rounded border border-edge-dim bg-surface-800 px-3 py-1.5 text-sm ${
												isUnused ? "opacity-60" : ""
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												<a
													href={`/skills?search=${encodeURIComponent(s.skillName)}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-mono text-text-2 truncate hover:text-accent-bright hover:underline"
													title={`Open skill ${s.skillName} in a new tab`}
												>
													{s.skillName}
												</a>
												<span className="text-xs text-text-4 font-mono truncate">
													{s.pluginName}
												</span>
											</div>
											<span
												className={`font-medium tabular-nums shrink-0 ${
													isUnused ? "text-text-4" : "text-text-1"
												}`}
											>
												{s.activationCount}
											</span>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>
			)}
		</Drawer>
	);
}

function MarketplaceSummary({
	marketplace,
	linkedSources,
}: {
	marketplace: Marketplace;
	linkedSources: MarketplaceSource[];
}) {
	return (
		<div className="space-y-3">
			<dl className="space-y-2 text-sm">
				<div className="flex items-baseline gap-3">
					<dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-4">
						Status
					</dt>
					<dd>
						<StatusBadge status={marketplace.status} />
					</dd>
				</div>
				<div className="flex items-baseline gap-3">
					<dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-4">
						URL
					</dt>
					<dd className="min-w-0 flex-1">
						{marketplace.url ? (
							<a
								href={marketplace.url}
								target="_blank"
								rel="noreferrer"
								className="text-accent-soft hover:underline break-all"
							>
								{marketplace.url}
							</a>
						) : (
							<span className="text-text-4">—</span>
						)}
					</dd>
				</div>
				<div className="flex items-baseline gap-3">
					<dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-4">
						Description
					</dt>
					<dd className="min-w-0 flex-1">
						{marketplace.description ? (
							<span className="text-text-2">{marketplace.description}</span>
						) : (
							<span className="text-text-4">—</span>
						)}
					</dd>
				</div>
				<div className="flex items-baseline gap-3">
					<dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-text-4">
						Git source
					</dt>
					<dd className="min-w-0 flex-1">
						{linkedSources.length === 0 ? (
							<span className="text-text-4">None linked</span>
						) : (
							<ul className="space-y-1">
								{linkedSources.map((s) => (
									<li key={s.id} className="flex items-center gap-2 min-w-0">
										<a
											href={s.gitUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 font-mono text-xs text-accent-soft hover:text-accent-bright hover:underline truncate"
											title={s.gitUrl}
										>
											<span className="truncate">{s.gitUrl}</span>
											<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
										</a>
										{s.branch && (
											<span className="text-xs font-mono text-text-3">
												{s.branch}
											</span>
										)}
										{s.hasToken && (
											<span className="badge badge-neutral shrink-0">token</span>
										)}
									</li>
								))}
							</ul>
						)}
					</dd>
				</div>
			</dl>
		</div>
	);
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
	return (
		<div className="rounded border border-edge-dim bg-surface-800 px-3 py-2">
			<p className="text-[10px] uppercase tracking-wide text-text-4">{label}</p>
			<p
				className={`mt-1 text-lg font-semibold tabular-nums ${
					muted ? "text-text-3" : "text-text-1"
				}`}
			>
				{value}
			</p>
		</div>
	);
}
