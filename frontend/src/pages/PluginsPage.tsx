import { MarketplaceBadge } from "@/components/marketplaces/MarketplaceBadge";
import { PluginSkillsDrawer } from "@/components/plugins/PluginSkillsDrawer";
import {
	Button,
	Card,
	IncludeIgnoredToggle,
	Input,
	PageHeader,
	SingleSelect,
	StatusChip,
	type StatusChipOption,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useIncludeIgnored } from "@/lib/use-include-ignored";
import { useStatusFilter } from "@/lib/use-status-filter";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PLUGIN_STATUSES, type Plugin, type PluginStatus } from "@/types/api";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type MarketplaceAssociation = "all" | "with" | "without";
const MARKETPLACE_ASSOCIATIONS: readonly MarketplaceAssociation[] = ["all", "with", "without"] as const;

function isMarketplaceAssociation(v: string | null): v is MarketplaceAssociation {
	return v === "all" || v === "with" || v === "without";
}

const ASSOC_LABELS: Record<MarketplaceAssociation, string> = {
	all: "All",
	with: "With marketplace",
	without: "Without marketplace",
};

const PLUGIN_STATUS_CHIP_OPTIONS: readonly StatusChipOption<PluginStatus>[] = [
	{ value: "approved", label: "Approved", tone: "success" },
	{ value: "to_review", label: "To review", tone: "warning" },
	{ value: "removed", label: "Removed", tone: "danger" },
	{ value: "ignored", label: "Ignored", tone: "neutral" },
];

const STATUS_FILTER_OPTIONS: {
	key: "all" | PluginStatus;
	label: string;
	dot?: string;
}[] = [
	{ key: "all", label: "All" },
	{ key: "to_review", label: "To review", dot: "var(--color-warning)" },
	{ key: "approved", label: "Approved", dot: "var(--color-success)" },
	{ key: "removed", label: "Removed", dot: "var(--color-danger)" },
	{ key: "ignored", label: "Ignored", dot: "var(--color-text-3)" },
];

const PL_GRID_COLS =
	"grid-cols-[40px_minmax(220px,1.6fr)_minmax(150px,1.1fr)_72px_104px_80px_72px_136px]";

const LOGO_GRADIENTS = [
	"linear-gradient(135deg, var(--color-accent-bright), color-mix(in srgb, var(--color-accent-bright) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-accent-2), color-mix(in srgb, var(--color-accent-2) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-magenta), color-mix(in srgb, var(--color-magenta) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-danger), color-mix(in srgb, var(--color-danger) 50%, var(--color-surface-700)))",
	"linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 50%, var(--color-surface-700)))",
];

function hashIndex(input: string, mod: number): number {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = (h * 31 + input.charCodeAt(i)) | 0;
	}
	return Math.abs(h) % mod;
}

function initialsFromName(name: string): string {
	const parts = name.split(/[-_\s]/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

function PluginLogo({ name }: { name: string }) {
	const gradient = LOGO_GRADIENTS[hashIndex(name, LOGO_GRADIENTS.length)];
	return (
		<span
			aria-hidden="true"
			className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-semibold text-surface-950 text-sm"
			style={{ background: gradient }}
		>
			{initialsFromName(name)}
		</span>
	);
}

function PluginNumCell({
	value,
	onClick,
	title,
	display,
}: {
	value: number;
	onClick?: () => void;
	title?: string;
	display?: string;
}) {
	const isZero = value === 0;
	const text = display ?? value.toLocaleString("en-US");
	const cls = cn("font-mono text-[15px] tabular-nums", isZero ? "text-text-4" : "text-text-1");
	if (onClick && !isZero) {
		return (
			<div className="text-right">
				<button type="button" onClick={onClick} title={title} className={cn(cls, "hover:underline")}>
					{text}
				</button>
			</div>
		);
	}
	return (
		<div className="text-right">
			<span className={cls} title={title}>
				{text}
			</span>
		</div>
	);
}

export default function PluginsPage() {
	const [items, setItems] = useState<Plugin[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const { status: statusFilter, setStatus } = useStatusFilter<PluginStatus>(
		"status",
		PLUGIN_STATUSES,
	);
	const { includeIgnored, setIncludeIgnored } = useIncludeIgnored();
	const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const selectAllRef = useRef<HTMLInputElement>(null);
	const [bulkBusy, setBulkBusy] = useState(false);
	const [bulkStatusResult, setBulkStatusResult] = useState<{
		updated: number;
		failed: number;
	} | null>(null);
	const [bulkError, setBulkError] = useState<string | null>(null);

	const search = searchParams.get("search") ?? "";
	const highlightName = searchParams.get("name") ?? "";
	const marketplaceFilter = searchParams.get("marketplace") ?? "";
	const mpAssocParam = searchParams.get("mpAssoc");
	const mpAssoc: MarketplaceAssociation = isMarketplaceAssociation(mpAssocParam) ? mpAssocParam : "all";
	const highlightedRowRef = useRef<HTMLDivElement | null>(null);

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

	function updateMpAssoc(value: MarketplaceAssociation) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (value === "all") next.delete("mpAssoc");
				else next.set("mpAssoc", value);
				return next;
			},
			{ replace: true },
		);
	}

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

	const [reloadToken, setReloadToken] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is a manual refetch trigger
	useEffect(() => {
		api.plugins
			.list({ includeIgnored })
			.then((res) => setItems(res.plugins))
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, [reloadToken, includeIgnored]);

	useEffect(() => {
		function onFocus() {
			if (document.visibilityState === "visible") setReloadToken((n) => n + 1);
		}
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onFocus);
		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onFocus);
		};
	}, []);

	async function handleStatusChange(pluginName: string, status: PluginStatus) {
		setItems((prev) =>
			prev.map((p) => (p.pluginName === pluginName ? { ...p, status } : p)),
		);
		try {
			await api.plugins.update(pluginName, { status });
		} catch {
			api.plugins
				.list({ includeIgnored })
				.then((res) => setItems(res.plugins))
				.catch(() => {});
		}
	}

	const filteredItems = useMemo(() => {
		return items.filter((p) => {
			if (statusFilter !== "all" && (p.status ?? "to_review") !== statusFilter) return false;
			if (marketplaceFilter && p.marketplaceName !== marketplaceFilter) return false;
			if (mpAssoc === "with" && !p.marketplaceName) return false;
			if (mpAssoc === "without" && p.marketplaceName) return false;
			if (search && !p.pluginName.toLowerCase().includes(search.toLowerCase())) return false;
			return true;
		});
	}, [items, statusFilter, search, marketplaceFilter, mpAssoc]);

	const filteredNames = useMemo(() => filteredItems.map((p) => p.pluginName), [filteredItems]);
	const visibleSelectedCount = useMemo(
		() => filteredNames.reduce((n, name) => n + (selected.has(name) ? 1 : 0), 0),
		[filteredNames, selected],
	);
	const allVisibleSelected =
		filteredNames.length > 0 && visibleSelectedCount === filteredNames.length;
	const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

	useEffect(() => {
		if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
	}, [someVisibleSelected]);

	// Drop selected names that are no longer in the filtered view, so the toolbar
	// count always matches what the user can actually act on.
	useEffect(() => {
		setSelected((prev) => {
			if (prev.size === 0) return prev;
			const visible = new Set(filteredNames);
			let changed = false;
			const next = new Set<string>();
			for (const name of prev) {
				if (visible.has(name)) next.add(name);
				else changed = true;
			}
			return changed ? next : prev;
		});
	}, [filteredNames]);

	function toggleRowSelect(name: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	}

	function toggleSelectAll() {
		setSelected((prev) => {
			if (allVisibleSelected) {
				const next = new Set(prev);
				for (const name of filteredNames) next.delete(name);
				return next;
			}
			const next = new Set(prev);
			for (const name of filteredNames) next.add(name);
			return next;
		});
	}

	function clearSelection() {
		setSelected(new Set());
	}

	useEffect(() => {
		if (!bulkStatusResult && !bulkError) return;
		const id = setTimeout(() => {
			setBulkStatusResult(null);
			setBulkError(null);
		}, 6000);
		return () => clearTimeout(id);
	}, [bulkStatusResult, bulkError]);

	async function handleBulkStatus(status: PluginStatus) {
		const names = Array.from(selected);
		if (names.length === 0 || bulkBusy) return;
		setBulkBusy(true);
		setBulkError(null);
		setBulkStatusResult(null);

		setItems((prev) =>
			prev.map((p) => (selected.has(p.pluginName) ? { ...p, status } : p)),
		);

		const results = await Promise.allSettled(
			names.map((name) => api.plugins.update(name, { status })),
		);
		const updated = results.filter((r) => r.status === "fulfilled").length;
		const failed = results.length - updated;
		setBulkStatusResult({ updated, failed });
		setSelected(new Set());
		setReloadToken((t) => t + 1);
		setBulkBusy(false);
	}

	async function handleViewCohort() {
		const names = Array.from(selected);
		if (names.length === 0 || bulkBusy) return;
		setBulkBusy(true);
		setBulkError(null);
		try {
			const responses = await Promise.all(
				names.map((name) => api.plugins.skills(name)),
			);
			const skillNames = new Set<string>();
			for (const res of responses) {
				for (const s of res.skills) {
					if (s.skillName) skillNames.add(s.skillName);
				}
			}
			if (skillNames.size === 0) {
				setBulkError("Selected plugins have no skills yet.");
				return;
			}
			const skills = [...skillNames].sort().join(",");
			navigate(`/cohorts?skills=${encodeURIComponent(skills)}`);
		} catch (e) {
			setBulkError(e instanceof Error ? e.message : String(e));
		} finally {
			setBulkBusy(false);
		}
	}

	useLayoutEffect(() => {
		if (!highlightName || loading) return;
		const node = highlightedRowRef.current;
		if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [highlightName, loading]);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<PageHeader
				title="Plugins"
				subtitle="Plugins discovered from installation events. Status reflects the approval state of the associated marketplace."
			/>

			{error && <p className="text-sm text-danger">{error}</p>}

			{items.length === 0 ? (
				<Card padding="lg" className="flex flex-col items-center gap-3 text-center py-12">
					<div className="w-12 h-12 rounded-full bg-surface-800 border border-edge flex items-center justify-center">
						<svg className="w-6 h-6 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} role="img" aria-label="No plugins">
							<path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
						</svg>
					</div>
					<div>
						<p className="text-sm font-medium text-text-2">No plugins discovered yet</p>
						<p className="text-xs text-text-4 mt-1">
							Plugins appear automatically when{" "}
							<code className="font-mono bg-surface-800 px-1 py-0.5 rounded text-text-3">
								plugin_installed
							</code>{" "}
							events are received.
						</p>
					</div>
				</Card>
			) : (
				<>
					<div className="flex flex-wrap items-center gap-3">
						<Input
							size="sm"
							placeholder="Search plugin name…"
							value={search}
							onChange={(e) => updateSearch(e.target.value)}
							className="min-w-64 max-w-md flex-1"
						/>
						<div
							role="tablist"
							aria-label="Filter by status"
							className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-edge-dim bg-surface-800 p-[2px]"
						>
							{STATUS_FILTER_OPTIONS.map((opt) => {
								const count =
									opt.key === "all"
										? items.length
										: items.filter((p) => (p.status ?? "to_review") === opt.key).length;
								const active = statusFilter === opt.key;
								return (
									<button
										key={opt.key}
										type="button"
										role="tab"
										aria-selected={active}
										onClick={() => setStatus(opt.key)}
										className={cn(
											"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
											active
												? "bg-surface-700 text-text-1 shadow-[inset_0_0_0_1px_var(--color-edge)]"
												: "text-text-3 hover:text-text-1",
										)}
									>
										{opt.dot && (
											<span
												aria-hidden="true"
												className="h-1.5 w-1.5 rounded-full"
												style={{ background: opt.dot, boxShadow: `0 0 4px ${opt.dot}` }}
											/>
										)}
										{opt.label}
										<span
											className={cn(
												"font-mono text-[10px]",
												active ? "text-text-2" : "text-text-4",
											)}
										>
											{count}
										</span>
									</button>
								);
							})}
						</div>
						<SingleSelect<MarketplaceAssociation>
							label="Marketplace"
							value={mpAssoc}
							onChange={updateMpAssoc}
							options={MARKETPLACE_ASSOCIATIONS.map((value) => ({
								value,
								label: ASSOC_LABELS[value],
							}))}
						/>
						<IncludeIgnoredToggle value={includeIgnored} onChange={setIncludeIgnored} />
						{marketplaceFilter && (
							<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
								Marketplace: {marketplaceFilter}
								<button
									type="button"
									aria-label="Clear marketplace filter"
									onClick={() => clearParam("marketplace")}
									className="text-text-4 hover:text-text-1"
								>
									×
								</button>
							</span>
						)}
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
						<span className="ml-auto font-mono text-xs text-text-4">
							{filteredItems.length}{" "}
							<span className="text-text-4">/ {items.length}</span>
						</span>
					</div>

					{selected.size > 0 && (
						<div className="flex flex-wrap items-center gap-3 rounded-md border border-accent-bright/30 bg-accent-bright/10 px-3 py-2 text-sm text-text-1">
							<span className="flex items-center gap-2">
								<span>
									<span className="font-medium">{selected.size}</span> selected
								</span>
								<button
									type="button"
									onClick={clearSelection}
									className="text-xs text-text-3 hover:text-text-1 hover:underline"
								>
									Clear
								</button>
							</span>
							<span className="h-5 border-l border-edge" aria-hidden />
							<div className="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={handleViewCohort}
									disabled={bulkBusy}
									title="Open the Cohorts page filtered to the skills of the selected plugins"
								>
									View cohort
								</Button>
								<StatusChip<PluginStatus>
									value={"" as PluginStatus}
									options={PLUGIN_STATUS_CHIP_OPTIONS}
									placeholderLabel="Set status…"
									onChange={(v) => handleBulkStatus(v)}
									disabled={bulkBusy}
									ariaLabel="Set status for selected plugins"
									align="right"
									size="md"
								/>
							</div>
						</div>
					)}

					{(bulkStatusResult || bulkError) && (
						<output
							className={cn(
								"block rounded-md border px-3 py-2 text-sm",
								bulkError
									? "border-danger/30 bg-danger/10 text-danger"
									: "border-accent-bright/30 bg-accent-bright/10 text-text-1",
							)}
						>
							{bulkError ? (
								<>{bulkError}</>
							) : bulkStatusResult ? (
								<>
									Updated <span className="font-medium">{bulkStatusResult.updated}</span>
									{bulkStatusResult.failed > 0 && (
										<>
											{" · "}
											<span className="text-text-3">
												{bulkStatusResult.failed} failed
											</span>
										</>
									)}
								</>
							) : null}
						</output>
					)}

					<div className="overflow-x-auto">
						<div className="min-w-[1100px] rounded-lg border border-edge bg-surface-900">
							<div
								className={cn(
									"grid items-center gap-3 border-b border-edge px-4 h-9 font-mono text-[10px] uppercase tracking-wider text-text-4",
									"bg-gradient-to-b from-accent-bright/[0.04] to-transparent",
									PL_GRID_COLS,
								)}
							>
								<div className="flex items-center">
									<input
										ref={selectAllRef}
										type="checkbox"
										aria-label={
											allVisibleSelected
												? "Deselect all filtered plugins"
												: "Select all filtered plugins"
										}
										checked={allVisibleSelected}
										onChange={toggleSelectAll}
										disabled={filteredItems.length === 0}
										className="h-4 w-4 cursor-pointer accent-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
									/>
								</div>
								<div>Plugin</div>
								<div>Marketplace</div>
								<div className="text-right">Skills</div>
								<div className="text-right">Activations</div>
								<div className="text-right">Installs</div>
								<div className="text-right">Users</div>
								<div>Status</div>
							</div>

							{filteredItems.length === 0 && (
								<div className="px-7 py-7 text-center font-mono text-xs text-text-4">
									No plugins match the current filters.
								</div>
							)}

							{filteredItems.map((plugin) => {
								const status = (plugin.status ?? "to_review") as PluginStatus;
								const isHighlighted = highlightName === plugin.pluginName;
								const isSelected = selected.has(plugin.pluginName);
								const openDrawer = () => setSelectedPlugin(plugin.pluginName);
								const activations = plugin.skillActivationCount;
								return (
									<div
										key={plugin.pluginName}
										ref={isHighlighted ? highlightedRowRef : undefined}
										className={cn(
											"grid items-center gap-3 border-t border-edge-dim px-4 py-3.5 transition-colors first:border-t-0 hover:bg-accent-bright/[0.03]",
											isHighlighted &&
												"bg-accent-bright/[0.06] ring-1 ring-inset ring-accent-bright/40",
											isSelected && !isHighlighted && "bg-accent-bright/5",
											PL_GRID_COLS,
										)}
									>
										<div className="flex items-center">
											<input
												type="checkbox"
												aria-label={`Select plugin ${plugin.pluginName}`}
												checked={isSelected}
												onChange={() => toggleRowSelect(plugin.pluginName)}
												className="h-4 w-4 cursor-pointer accent-accent-bright"
											/>
										</div>
										<div className="flex min-w-0 items-center gap-3">
											<PluginLogo name={plugin.pluginName} />
											<div className="min-w-0">
												<button
													type="button"
													onClick={openDrawer}
													className="truncate font-mono text-sm text-text-1 hover:underline"
													title={plugin.pluginName}
												>
													{plugin.pluginName}
												</button>
												<div className="mt-0.5 truncate text-xs text-text-3">
													{plugin.skillCount} skill{plugin.skillCount === 1 ? "" : "s"}
													{plugin.skillCount > 0 && (
														<>
															{" · last activation "}
															{plugin.lastSkillActivationAt
																? formatRelativeTime(plugin.lastSkillActivationAt)
																: "never"}
														</>
													)}
												</div>
											</div>
										</div>

										<div className="min-w-0">
											{plugin.marketplaceName ? (
												<MarketplaceBadge
													name={plugin.marketplaceName}
													status={plugin.marketplaceStatus}
												/>
											) : (
												<span
													className="text-text-4"
													title="Locally installed (no marketplace)"
												>
													—
												</span>
											)}
										</div>

										<PluginNumCell
											value={plugin.skillCount}
											onClick={plugin.skillCount > 0 ? openDrawer : undefined}
											title="View plugin skills"
										/>
										<PluginNumCell
											value={activations}
											onClick={plugin.skillCount > 0 ? openDrawer : undefined}
											title={
												plugin.skillCount === 0
													? undefined
													: activations === 0
														? "Skills declared but never activated — click to inspect"
														: "View plugin skills"
											}
											display={
												plugin.skillCount === 0
													? "—"
													: activations === 0
														? "0"
														: activations.toLocaleString("en-US")
											}
										/>
										<PluginNumCell value={plugin.installationCount} />
										<PluginNumCell value={plugin.uniqueUserCount} />

										<div>
											<StatusChip
												value={status}
												options={PLUGIN_STATUS_CHIP_OPTIONS}
												onChange={(v) => handleStatusChange(plugin.pluginName, v)}
												ariaLabel={`Status for ${plugin.pluginName}`}
											/>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</>
			)}

			<PluginSkillsDrawer
				pluginName={selectedPlugin}
				onClose={() => setSelectedPlugin(null)}
			/>
		</div>
	);
}
