import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SkillDetailDrawer } from "@/components/skills/SkillDetailDrawer";
import {
	Button,
	ConfirmDialog,
	MultiSelect,
	PageHeader,
	SearchBar,
	SegmentedControl,
	Select,
	Sparkline,
	StatusBadge,
	StatusFilter,
	TBody,
	THead,
	Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useStatusFilter } from "@/lib/use-status-filter";
import { cn } from "@/lib/utils";
import {
	SKILL_STATUSES,
	type DashboardPeriod,
	type MarketplaceRef,
	type SkillStatus,
	type SkillTableRow,
} from "@/types/api";

const MP_STATUS_STYLES: Record<string, string> = {
	approved: "bg-success/15 text-success border-success/30",
	denied: "bg-danger/15 text-danger border-danger/30",
	to_review: "bg-warning/15 text-warning border-warning/30",
};

function MarketplaceBadge({ mp }: { mp: MarketplaceRef }) {
	const style = MP_STATUS_STYLES[mp.status] ?? MP_STATUS_STYLES.to_review;
	return (
		<a
			href={`/marketplaces?name=${encodeURIComponent(mp.name)}`}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(e) => e.stopPropagation()}
			title={`Open marketplace ${mp.name} in a new tab`}
			className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono hover:underline ${style}`}
		>
			{mp.name}
		</a>
	);
}

const STATUS_OPTIONS: { value: SkillStatus; label: string }[] = [
	{ value: "unknown", label: "Unknown" },
	{ value: "to_review", label: "To Review" },
	{ value: "approved", label: "Approved" },
	{ value: "removed", label: "Removed" },
];

const TRIGGERS: {
	key: "userSlash" | "claudeProactive" | "nestedSkill";
	label: string;
	swatch: string;
	gradient: string;
}[] = [
	{
		key: "userSlash",
		label: "user-slash",
		swatch: "bg-accent-bright",
		gradient: "linear-gradient(90deg, var(--color-accent), var(--color-accent-bright))",
	},
	{
		key: "claudeProactive",
		label: "claude-proactive",
		swatch: "bg-accent-2",
		gradient: "linear-gradient(90deg, var(--color-accent-2), var(--color-accent-2-soft))",
	},
	{
		key: "nestedSkill",
		label: "nested-skill",
		swatch: "bg-warning",
		gradient: "linear-gradient(90deg, var(--color-warning), var(--color-caution))",
	},
];

function TriggerMixCell({ row }: { row: SkillTableRow }) {
	const sum = Math.max(1, row.total);
	return (
		<td className="px-4 py-3">
			<div className="flex h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-700">
				{TRIGGERS.map((t) => {
					const v = row[t.key];
					return (
						<div
							key={t.key}
							className="h-full"
							style={{ width: `${(v / sum) * 100}%`, background: t.gradient }}
							title={`${t.label} · ${v}`}
						/>
					);
				})}
			</div>
			<div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-text-4">
				{TRIGGERS.map((t) => (
					<span key={t.key} className="inline-flex items-center gap-1">
						<span className={cn("inline-block h-1.5 w-1.5 rounded-sm", t.swatch)} />
						{row[t.key]}
					</span>
				))}
			</div>
		</td>
	);
}

function computeDeltaPct(dailyCounts: number[]): number {
	if (dailyCounts.length < 4) return 0;
	const mid = Math.floor(dailyCounts.length / 2);
	const first = dailyCounts.slice(0, mid).reduce((a, b) => a + b, 0);
	const second = dailyCounts.slice(mid).reduce((a, b) => a + b, 0);
	if (first === 0) return second > 0 ? 100 : 0;
	return Math.round(((second - first) / first) * 100);
}

type SourceFilter = "all" | "bundled" | "external";
type UsageFilter = "all" | "activated" | "never_used";
type SortKey =
	| "skillName"
	| "total"
	| "status"
	| "userSlash"
	| "claudeProactive"
	| "nestedSkill"
	| "lastSeenAt";
type SortDir = "asc" | "desc";

const SOURCE_VALUES: SourceFilter[] = ["all", "bundled", "external"];
const USAGE_VALUES: UsageFilter[] = ["all", "activated", "never_used"];
const SORT_KEYS: SortKey[] = [
	"skillName",
	"total",
	"status",
	"userSlash",
	"claudeProactive",
	"nestedSkill",
	"lastSeenAt",
];

function lastUsedLabel(iso: string | null): { text: string; cold: boolean } {
	if (!iso) return { text: "—", cold: true };
	const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
	if (min < 60) return { text: `${min}m ago`, cold: false };
	const h = Math.floor(min / 60);
	if (h < 24) return { text: `${h}h ago`, cold: false };
	const d = Math.floor(h / 24);
	return { text: `${d}d ago`, cold: min > 1440 };
}
const TRIGGER_KEYS = TRIGGERS.map((t) => t.key);
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const NO_MARKETPLACE = "__none__";
const NO_MARKETPLACE_LABEL = "(none)";
const NO_PLUGIN_KEY = "__none__";

function rowKey(row: { skillName: string; pluginName: string | null }): string {
	return `${row.skillName}::${row.pluginName ?? NO_PLUGIN_KEY}`;
}

function keyToEntry(key: string): { skillName: string; pluginName: string } {
	const idx = key.indexOf("::");
	const skillName = key.slice(0, idx);
	const pluginPart = key.slice(idx + 2);
	return { skillName, pluginName: pluginPart === NO_PLUGIN_KEY ? "" : pluginPart };
}

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
	{ value: 7, label: "7d" },
	{ value: 30, label: "30d" },
	{ value: 90, label: "90d" },
	{ value: "all", label: "All" },
];

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
	7: "the last 7 days",
	30: "the last 30 days",
	90: "the last 90 days",
	all: "all time",
};

function pick<T extends string>(raw: string | null, values: readonly T[], fallback: T): T {
	return values.includes((raw ?? "") as T) ? (raw as T) : fallback;
}

function pickPeriod(raw: string | null): DashboardPeriod {
	if (raw === "all") return "all";
	const n = Number.parseInt(raw ?? "", 10);
	if (n === 7 || n === 30 || n === 90) return n;
	return 30;
}

function pickList(raw: string | null, allowed: readonly string[]): string[] {
	if (!raw) return [];
	return raw.split(",").filter((v) => v && allowed.includes(v));
}

export default function SkillsTablePage() {
	const [rows, setRows] = useState<SkillTableRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchParams, setSearchParams] = useSearchParams();
	const [openSkill, setOpenSkill] = useState<string | null>(null);
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const selectAllRef = useRef<HTMLInputElement>(null);

	const period = pickPeriod(searchParams.get("period"));
	const search = searchParams.get("search") ?? "";
	const sourceFilter = pick<SourceFilter>(searchParams.get("source"), SOURCE_VALUES, "all");
	const usageFilter = pick<UsageFilter>(searchParams.get("usage"), USAGE_VALUES, "all");
	const sortKey = pick<SortKey>(searchParams.get("sort"), SORT_KEYS, "total");
	const sortDir: SortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
	const pluginFilter = searchParams.get("plugin") ?? "";
	const { status: statusFilter, setStatus } = useStatusFilter<SkillStatus>(
		"status",
		SKILL_STATUSES,
	);

	const allMarketplaceNames = useMemo(() => {
		const names = new Set<string>();
		for (const row of rows) {
			for (const mp of row.marketplaces) names.add(mp.name);
		}
		return Array.from(names).sort();
	}, [rows]);

	const marketplaceFilterValues = useMemo(
		() => [...allMarketplaceNames, NO_MARKETPLACE],
		[allMarketplaceNames],
	);
	const marketplaces = pickList(searchParams.get("marketplace"), marketplaceFilterValues);
	const triggers = pickList(searchParams.get("trigger"), TRIGGER_KEYS);

	const debouncedSearch = useDebouncedValue(search, 150);

	function updateParam(key: string, value: string, defaultValue: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (!value || value === defaultValue) next.delete(key);
				else next.set(key, value);
				return next;
			},
			{ replace: true },
		);
	}

	function setListParam(key: string, values: string[]) {
		updateParam(key, values.join(","), "");
	}

	function setPeriod(value: DashboardPeriod) {
		updateParam("period", String(value), "30");
	}

	function toggleSort(key: SortKey) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (sortKey === key) {
					if (sortDir === "desc") {
						next.set("sort", key);
						next.set("dir", "asc");
					} else {
						next.delete("sort");
						next.delete("dir");
					}
				} else {
					next.set("sort", key);
					next.delete("dir");
				}
				return next;
			},
			{ replace: true },
		);
	}

	async function handleStatusChange(
		skillName: string,
		pluginName: string,
		status: SkillStatus,
	) {
		setRows((prev) =>
			prev.map((r) =>
				r.skillName === skillName && (r.pluginName ?? "") === pluginName
					? { ...r, status }
					: r,
			),
		);
		try {
			await api.skills.updateStatus({ skillName, pluginName, status });
		} catch {
			setReloadToken((n) => n + 1);
		}
	}

	function clearAllFilters() {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams();
				const periodParam = prev.get("period");
				if (periodParam) next.set("period", periodParam);
				return next;
			},
			{ replace: true },
		);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is a manual refetch trigger
	useEffect(() => {
		setLoading(true);
		setError(null);
		let cancelled = false;
		api.skills
			.table(period)
			.then((res) => {
				if (!cancelled) setRows(res.rows);
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
	}, [period, reloadToken]);

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

	const filteredRows = useMemo(() => {
		const q = debouncedSearch.trim();
		const scored: { row: SkillTableRow; score: number }[] = [];
		for (const row of rows) {
			if (pluginFilter && row.pluginName !== pluginFilter) continue;
			if (sourceFilter === "bundled" && row.skillSource !== "bundled") continue;
			if (sourceFilter === "external" && row.skillSource === "bundled") continue;
			if (statusFilter !== "all" && (row.status ?? "unknown") !== statusFilter) continue;
			if (marketplaces.length > 0) {
				const wantsNone = marketplaces.includes(NO_MARKETPLACE);
				const wantedNames = marketplaces.filter((m) => m !== NO_MARKETPLACE);
				const hasNone = row.marketplaces.length === 0;
				const matchesNamed = row.marketplaces.some((mp) => wantedNames.includes(mp.name));
				if (!((wantsNone && hasNone) || matchesNamed)) continue;
			}
			if (triggers.length > 0 && !triggers.some((t) => (row[t as keyof SkillTableRow] as number) > 0)) continue;
			if (usageFilter === "activated" && row.total === 0) continue;
			if (usageFilter === "never_used" && row.total !== 0) continue;
			if (q) {
				const candidates = [
					row.skillName,
					row.pluginName ?? "",
					row.skillSource ?? "",
					...row.marketplaces.map((m) => m.name),
				];
				let best: number | null = null;
				for (const c of candidates) {
					const s = fuzzyScore(q, c);
					if (s !== null && (best === null || s < best)) best = s;
				}
				if (best === null) continue;
				scored.push({ row, score: best });
			} else {
				scored.push({ row, score: 0 });
			}
		}

		const sorted = scored.slice();
		if (q && sortKey === "total" && sortDir === "desc") {
			sorted.sort((a, b) => a.score - b.score || b.row.total - a.row.total);
		} else if (sortKey === "lastSeenAt") {
			sorted.sort((a, b) => {
				const at = a.row.lastSeenAt ? new Date(a.row.lastSeenAt).getTime() : null;
				const bt = b.row.lastSeenAt ? new Date(b.row.lastSeenAt).getTime() : null;
				if (at === bt) return 0;
				if (at === null) return 1;
				if (bt === null) return -1;
				return sortDir === "asc" ? at - bt : bt - at;
			});
		} else {
			sorted.sort((a, b) => {
				const av = a.row[sortKey] as string | number;
				const bv = b.row[sortKey] as string | number;
				if (typeof av === "string" && typeof bv === "string") {
					return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
				}
				const an = av as number;
				const bn = bv as number;
				return sortDir === "asc" ? an - bn : bn - an;
			});
		}
		return sorted.map((s) => s.row);
	}, [
		rows,
		debouncedSearch,
		sourceFilter,
		statusFilter,
		marketplaces,
		triggers,
		usageFilter,
		sortKey,
		sortDir,
		pluginFilter,
	]);

	const suggestions = useMemo(() => {
		const q = debouncedSearch.trim();
		if (!q) return [];
		const ranked: { row: SkillTableRow; score: number }[] = [];
		for (const row of rows) {
			const s = fuzzyScore(q, row.skillName);
			if (s !== null) ranked.push({ row, score: s });
		}
		ranked.sort((a, b) => a.score - b.score || b.row.total - a.row.total);
		return ranked.slice(0, 5).map((r) => ({
			id: r.row.skillName,
			label: r.row.skillName,
			hint: `${r.row.total} · ${r.row.marketplaces[0]?.name ?? "—"}`,
		}));
	}, [rows, debouncedSearch]);

	const filteredKeys = useMemo(() => filteredRows.map(rowKey), [filteredRows]);
	const visibleSelectedCount = useMemo(
		() => filteredKeys.reduce((n, k) => n + (selectedKeys.has(k) ? 1 : 0), 0),
		[filteredKeys, selectedKeys],
	);
	const allVisibleSelected =
		filteredKeys.length > 0 && visibleSelectedCount === filteredKeys.length;
	const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

	useEffect(() => {
		if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
	}, [someVisibleSelected]);

	// Drop selections that are no longer in the filtered set so the bulk action bar
	// always reflects rows the user can actually see.
	useEffect(() => {
		setSelectedKeys((prev) => {
			if (prev.size === 0) return prev;
			const visible = new Set(filteredKeys);
			let changed = false;
			const next = new Set<string>();
			for (const k of prev) {
				if (visible.has(k)) next.add(k);
				else changed = true;
			}
			return changed ? next : prev;
		});
	}, [filteredKeys]);

	function toggleRow(key: string) {
		setSelectedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function toggleSelectAll() {
		setSelectedKeys((prev) => {
			if (allVisibleSelected) {
				const next = new Set(prev);
				for (const k of filteredKeys) next.delete(k);
				return next;
			}
			const next = new Set(prev);
			for (const k of filteredKeys) next.add(k);
			return next;
		});
	}

	function clearSelection() {
		setSelectedKeys(new Set());
	}

	async function handleBulkDelete() {
		setDeleting(true);
		setDeleteError(null);
		try {
			const entries = Array.from(selectedKeys).map(keyToEntry);
			await api.skills.deleteMany(entries);
			setSelectedKeys(new Set());
			setConfirmOpen(false);
			setReloadToken((t) => t + 1);
		} catch (e) {
			setDeleteError(e instanceof Error ? e.message : String(e));
		} finally {
			setDeleting(false);
		}
	}

	const triggerOptions = TRIGGERS.map((t) => ({ value: t.key, label: t.label }));
	const marketplaceOptions = [
		...allMarketplaceNames.map((n) => ({ value: n, label: n })),
		{ value: NO_MARKETPLACE, label: NO_MARKETPLACE_LABEL },
	];

	const filtersActive =
		search !== "" ||
		sourceFilter !== "all" ||
		usageFilter !== "all" ||
		statusFilter !== "all" ||
		marketplaces.length > 0 ||
		triggers.length > 0 ||
		pluginFilter !== "";

	const isLeastUsedPreset =
		usageFilter === "activated" && sortKey === "total" && sortDir === "asc";

	function applyLeastUsedPreset() {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (isLeastUsedPreset) {
					next.delete("usage");
					next.delete("sort");
					next.delete("dir");
				} else {
					next.set("usage", "activated");
					next.set("sort", "total");
					next.set("dir", "asc");
				}
				return next;
			},
			{ replace: true },
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				title="Skills"
				subtitle={`All known skills, with activations in ${PERIOD_LABEL[period]}.`}
				actions={
					<SegmentedControl
						ariaLabel="Time range"
						value={period}
						onChange={setPeriod}
						options={PERIOD_OPTIONS}
					/>
				}
			/>

			<SearchBar
				value={search}
				onChange={(v) => updateParam("search", v, "")}
				placeholder="Search skills, marketplaces, sources…"
				suggestions={suggestions}
				onSelectSuggestion={(id) => setOpenSkill(id)}
			/>

			<div className="flex flex-wrap items-center gap-2">
				<MultiSelect
					label="Marketplace"
					options={marketplaceOptions}
					values={marketplaces}
					onChange={(v) => setListParam("marketplace", v)}
				/>
				<MultiSelect
					label="Trigger"
					options={triggerOptions}
					values={triggers}
					onChange={(v) => setListParam("trigger", v)}
				/>
				<StatusFilter<SkillStatus>
					value={statusFilter}
					onChange={setStatus}
					options={SKILL_STATUSES}
				/>
				<Select
					size="sm"
					value={sourceFilter}
					onChange={(e) => updateParam("source", e.target.value, "all")}
				>
					<option value="all">Source: All</option>
					<option value="bundled">Bundled</option>
					<option value="external">External</option>
				</Select>
				<Select
					size="sm"
					value={usageFilter}
					onChange={(e) => updateParam("usage", e.target.value, "all")}
				>
					<option value="all">Usage: All</option>
					<option value="activated">Activated</option>
					<option value="never_used">Never used</option>
				</Select>
				<Button
					variant="secondary"
					size="sm"
					onClick={applyLeastUsedPreset}
					aria-pressed={isLeastUsedPreset}
					title="Show activated skills sorted ascending by total"
					className={cn(
						isLeastUsedPreset &&
							"border-accent-bright bg-accent-bright/15 text-accent-bright hover:bg-accent-bright/20",
					)}
				>
					Least used
				</Button>
				<span className="text-xs text-text-4 ml-auto">
					{loading ? "—" : `${filteredRows.length} / ${rows.length}`}
				</span>
				{filtersActive && !loading && (
					<button
						type="button"
						onClick={clearAllFilters}
						className="text-xs text-accent-bright hover:underline"
					>
						Clear all
					</button>
				)}
			</div>

			{filtersActive && !loading && (
				<div className="flex flex-wrap items-center gap-1.5">
					{search && (
						<FilterPill label={`"${search}"`} onRemove={() => updateParam("search", "", "")} />
					)}
					{pluginFilter && (
						<FilterPill
							label={`Plugin: ${pluginFilter}`}
							onRemove={() => updateParam("plugin", "", "")}
						/>
					)}
					{sourceFilter !== "all" && (
						<FilterPill
							label={`Source: ${sourceFilter}`}
							onRemove={() => updateParam("source", "", "all")}
						/>
					)}
					{usageFilter !== "all" && (
						<FilterPill
							label={`Usage: ${usageFilter === "activated" ? "Activated" : "Never used"}`}
							onRemove={() => updateParam("usage", "", "all")}
						/>
					)}
					{statusFilter !== "all" && (
						<FilterPill label={`Status: ${statusFilter}`} onRemove={() => setStatus("all")} />
					)}
					{marketplaces.map((m) => (
						<FilterPill
							key={`mp-${m}`}
							label={`Marketplace: ${m === NO_MARKETPLACE ? NO_MARKETPLACE_LABEL : m}`}
							onRemove={() => setListParam("marketplace", marketplaces.filter((x) => x !== m))}
						/>
					))}
					{triggers.map((t) => (
						<FilterPill
							key={`tr-${t}`}
							label={`Trigger: ${TRIGGERS.find((tr) => tr.key === t)?.label ?? t}`}
							onRemove={() => setListParam("trigger", triggers.filter((x) => x !== t))}
						/>
					))}
				</div>
			)}

			{selectedKeys.size > 0 && (
				<div className="flex items-center gap-3 rounded-md border border-accent-bright/30 bg-accent-bright/10 px-3 py-2 text-sm text-text-1">
					<span>
						<span className="font-medium">{selectedKeys.size}</span> selected
					</span>
					<button
						type="button"
						onClick={clearSelection}
						className="text-xs text-text-3 hover:text-text-1 hover:underline"
					>
						Clear
					</button>
					<div className="ml-auto">
						<Button
							variant="danger"
							size="sm"
							onClick={() => {
								setDeleteError(null);
								setConfirmOpen(true);
							}}
						>
							Delete…
						</Button>
					</div>
				</div>
			)}

			<Table>
				<THead>
					<tr>
						<th className="w-10 px-3 py-3">
							<input
								ref={selectAllRef}
								type="checkbox"
								aria-label={
									allVisibleSelected ? "Deselect all filtered skills" : "Select all filtered skills"
								}
								checked={allVisibleSelected}
								onChange={toggleSelectAll}
								disabled={filteredRows.length === 0}
								className="h-4 w-4 cursor-pointer accent-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
							/>
						</th>
						<SortableHeader
							label="Skill"
							sortKey="skillName"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-left"
						/>
						<SortableHeader
							label="Total"
							sortKey="total"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-right"
						/>
						<th className="text-left px-4 py-3 font-medium text-text-3">Δ 30d</th>
						<th className="text-left px-4 py-3 font-medium text-text-3">Trend</th>
						<th className="text-left px-4 py-3 font-medium text-text-3">Marketplaces</th>
						<th className="text-left px-4 py-3 font-medium text-text-3">Source</th>
						<SortableHeader
							label="Status"
							sortKey="status"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-left"
						/>
						<SortableHeader
							label="Last used"
							sortKey="lastSeenAt"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-left"
						/>
						<th className="min-w-44 text-left px-4 py-3 font-medium text-text-3">Trigger mix</th>
					</tr>
				</THead>
				<TBody>
					{loading ? (
						SKELETON_KEYS.map((k) => <SkeletonRow key={k} />)
					) : error ? (
						<tr>
							<td colSpan={10} className="px-4 py-8 text-center text-danger text-sm">
								{error}
							</td>
						</tr>
					) : rows.length === 0 ? (
						<tr>
							<td colSpan={10} className="px-4 py-12 text-center text-text-3 text-sm">
								No skills found.
							</td>
						</tr>
					) : filteredRows.length === 0 ? (
						<tr>
							<td colSpan={10} className="px-4 py-8 text-center text-text-4 text-sm">
								No skills match the current filters.
								{filtersActive && (
									<>
										{" "}
										<button
											type="button"
											onClick={clearAllFilters}
											className="text-accent-bright hover:underline"
										>
											Clear all
										</button>
									</>
								)}
							</td>
						</tr>
					) : (
						filteredRows.map((row) => {
							const key = rowKey(row);
							const checked = selectedKeys.has(key);
							return (
							<tr
								key={key}
								onClick={() => setOpenSkill(row.skillName)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										setOpenSkill(row.skillName);
									}
								}}
								tabIndex={0}
								className={cn(
									"hover:bg-surface-800 transition-colors cursor-pointer focus:outline-none focus:bg-surface-800",
									row.total === 0 && "opacity-60",
									checked && "bg-accent-bright/5",
								)}
							>
								<td
									className="w-10 px-3 py-3"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<input
										type="checkbox"
										aria-label={`Select skill ${row.skillName}`}
										checked={checked}
										onChange={() => toggleRow(key)}
										className="h-4 w-4 cursor-pointer accent-accent-bright"
									/>
								</td>
								<td className="px-4 py-3 font-mono text-text-1">
									<span className="flex flex-col gap-0.5">
										<span className="flex items-center gap-2">
											{row.skillName}
											{row.total === 0 && (
												<span className="inline-flex items-center rounded border border-edge bg-surface-800 px-1.5 py-0.5 text-xs text-text-3">
													Never used
												</span>
											)}
										</span>
										<span className="text-xs text-text-3">
											{row.pluginName ?? <span className="text-text-4">no plugin</span>}
										</span>
									</span>
								</td>
								<td className="px-4 py-3 text-right font-mono text-text-1 tabular-nums">
									{row.total.toLocaleString("en-US")}
								</td>
								<td className="px-4 py-3">
									{(() => {
										const pct = computeDeltaPct(row.dailyCounts);
										if (pct === 0) return <span className="font-mono text-[11px] text-text-4">·</span>;
										return (
											<span className={cn(
												"font-mono text-[11px]",
												pct > 0 ? "text-success" : "text-danger",
											)}>
												{pct > 0 ? `+${pct}%` : `${pct}%`}
											</span>
										);
									})()}
								</td>
								<td className="px-4 py-3">
									<Sparkline
										values={row.dailyCounts}
										width={80}
										height={20}
										strokeClass={row.total === 0 ? "stroke-text-4" : "stroke-accent-bright"}
										fillClass={row.total === 0 ? "fill-transparent" : "fill-accent-bright/15"}
									/>
								</td>
								<td className="px-4 py-3">
									{row.marketplaces.length > 0 ? (
										<div className="flex flex-wrap gap-1">
											{row.marketplaces.map((mp) => (
												<MarketplaceBadge key={mp.name} mp={mp} />
											))}
										</div>
									) : (
										<span className="text-text-4">—</span>
									)}
								</td>
								<td className="px-4 py-3">
									{row.skillSource === "bundled" ? (
										<span className="inline-flex items-center rounded border border-accent-soft/30 bg-accent-bright/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-soft">
											bundled
										</span>
									) : (
										<span className="font-mono text-[11px] text-text-4">external</span>
									)}
								</td>
								<td className="px-4 py-3">
									{(() => {
										const status = (row.status ?? "unknown") as SkillStatus;
										const pluginName = row.pluginName ?? "";
										if (pluginName === "") {
											return (
												<div className="flex items-center gap-2">
													<StatusBadge status={status} />
													<Select
														size="sm"
														aria-label={`Status for ${row.skillName}`}
														value={status}
														onChange={(e) =>
															handleStatusChange(
																row.skillName,
																"",
																e.target.value as SkillStatus,
															)
														}
													>
														{STATUS_OPTIONS.map((opt) => (
															<option key={opt.value} value={opt.value}>
																{opt.label}
															</option>
														))}
													</Select>
												</div>
											);
										}
										return (
											<span title={`Status inherited from plugin ${pluginName}`}>
												<StatusBadge status={status} />
											</span>
										);
									})()}
								</td>
								<td className="px-4 py-3">
									{(() => {
										const { text, cold } = lastUsedLabel(row.lastSeenAt);
										return (
											<span
												title={row.lastSeenAt ?? "Never used"}
												className={cn(
													"font-mono text-[11px]",
													cold ? "text-text-4" : "text-text-3",
												)}
											>
												{text}
											</span>
										);
									})()}
								</td>
								<TriggerMixCell row={row} />
							</tr>
							);
						})
					)}
				</TBody>
			</Table>

			<SkillDetailDrawer
				skillName={openSkill}
				period={period}
				onClose={() => setOpenSkill(null)}
			/>

			<ConfirmDialog
				open={confirmOpen}
				title={`Delete ${selectedKeys.size} skill${selectedKeys.size === 1 ? "" : "s"}?`}
				description={
					<div className="space-y-2">
						<p>
							This will permanently delete{" "}
							<span className="font-medium text-text-1">
								{selectedKeys.size} skill{selectedKeys.size === 1 ? "" : "s"}
							</span>{" "}
							and{" "}
							<span className="font-medium text-text-1">
								every <span className="font-mono">skill_activated</span> event
							</span>{" "}
							recorded for them. This cannot be undone.
						</p>
						<p className="text-xs text-text-3">
							If new events arrive for a deleted skill later, the skill will reappear.
						</p>
					</div>
				}
				confirmLabel="Delete"
				confirmVariant="danger"
				requireTyped="delete"
				loading={deleting}
				error={deleteError}
				onConfirm={handleBulkDelete}
				onClose={() => {
					if (!deleting) {
						setConfirmOpen(false);
						setDeleteError(null);
					}
				}}
			/>
		</div>
	);
}

function SortableHeader({
	label,
	sortKey,
	currentKey,
	currentDir,
	onSort,
	className,
}: {
	label: React.ReactNode;
	sortKey: SortKey;
	currentKey: SortKey;
	currentDir: SortDir;
	onSort: (key: SortKey) => void;
	className?: string;
}) {
	const active = sortKey === currentKey;
	return (
		<th className={cn("px-4 py-3 font-medium text-text-3", className)}>
			<button
				type="button"
				onClick={() => onSort(sortKey)}
				className={cn(
					"inline-flex items-center gap-1 transition-colors hover:text-text-1",
					active && "text-text-1",
				)}
			>
				{label}
				<span aria-hidden="true" className="text-xs">
					{active ? (currentDir === "asc" ? "▲" : "▼") : "↕"}
				</span>
			</button>
		</th>
	);
}

function SkeletonRow() {
	return (
		<tr>
			<td className="w-10 px-3 py-3">
				<div className="h-4 w-4 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-44 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3 text-right">
				<div className="ml-auto h-3 w-10 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-8 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-20 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-24 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-16 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-20 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-14 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3">
				<div className="h-3 w-32 rounded bg-surface-800 animate-pulse" />
			</td>
		</tr>
	);
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-800 px-2 py-0.5 text-xs text-text-2">
			{label}
			<button
				type="button"
				aria-label={`Remove ${label}`}
				onClick={onRemove}
				className="text-text-4 hover:text-text-1"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
					<path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
				</svg>
			</button>
		</span>
	);
}
