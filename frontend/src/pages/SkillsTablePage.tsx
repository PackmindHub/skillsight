import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchBar } from "@/components/ui/SearchBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sparkline } from "@/components/ui/Sparkline";
import { SkillDetailDrawer } from "@/components/skills/SkillDetailDrawer";
import { api } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import type { DashboardPeriod, MarketplaceRef, SkillTableRow } from "@/types/api";

const MP_STATUS_STYLES: Record<string, string> = {
	approved: "bg-success/15 text-success border-success/30",
	denied: "bg-danger/15 text-danger border-danger/30",
	to_review: "bg-warning/15 text-warning border-warning/30",
};

function MarketplaceBadge({ mp }: { mp: MarketplaceRef }) {
	const style = MP_STATUS_STYLES[mp.status] ?? MP_STATUS_STYLES.to_review;
	return (
		<span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono ${style}`}>
			{mp.name}
		</span>
	);
}

const TRIGGERS: { key: "userSlash" | "claudeProactive" | "nestedSkill"; label: string; color: string }[] = [
	{ key: "userSlash", label: "user-slash", color: "bg-accent-bright" },
	{ key: "claudeProactive", label: "claude-proactive", color: "bg-success" },
	{ key: "nestedSkill", label: "nested-skill", color: "bg-warning" },
];

function ProgressCell({ count, total, color }: { count: number; total: number; color: string }) {
	const pct = total > 0 ? (count / total) * 100 : 0;
	return (
		<td className="px-4 py-3 group/cell relative">
			<div className="h-3 w-full bg-surface-700 rounded-full overflow-hidden">
				<div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
			</div>
			<span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block whitespace-nowrap rounded bg-surface-800 border border-edge px-2 py-1 text-xs text-text-1 z-10">
				{count} ({pct.toFixed(1)}%)
			</span>
		</td>
	);
}

type SourceFilter = "all" | "bundled" | "external";
type UsageFilter = "all" | "activated" | "never_used";
type SortKey = "skillName" | "total" | "userSlash" | "claudeProactive" | "nestedSkill";
type SortDir = "asc" | "desc";

const SOURCE_VALUES: SourceFilter[] = ["all", "bundled", "external"];
const USAGE_VALUES: UsageFilter[] = ["all", "activated", "never_used"];
const SORT_KEYS: SortKey[] = ["skillName", "total", "userSlash", "claudeProactive", "nestedSkill"];
const TRIGGER_KEYS = TRIGGERS.map((t) => t.key);
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

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

	const period = pickPeriod(searchParams.get("period"));
	const search = searchParams.get("search") ?? "";
	const sourceFilter = pick<SourceFilter>(searchParams.get("source"), SOURCE_VALUES, "all");
	const usageFilter = pick<UsageFilter>(searchParams.get("usage"), USAGE_VALUES, "all");
	const sortKey = pick<SortKey>(searchParams.get("sort"), SORT_KEYS, "total");
	const sortDir: SortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";

	const allMarketplaceNames = useMemo(() => {
		const names = new Set<string>();
		for (const row of rows) {
			for (const mp of row.marketplaces) names.add(mp.name);
		}
		return Array.from(names).sort();
	}, [rows]);

	const marketplaces = pickList(searchParams.get("marketplace"), allMarketplaceNames);
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
	}, [period]);

	const filteredRows = useMemo(() => {
		const q = debouncedSearch.trim();
		const scored: { row: SkillTableRow; score: number }[] = [];
		for (const row of rows) {
			if (sourceFilter === "bundled" && row.skillSource !== "bundled") continue;
			if (sourceFilter === "external" && row.skillSource === "bundled") continue;
			if (marketplaces.length > 0 && !row.marketplaces.some((mp) => marketplaces.includes(mp.name))) continue;
			if (triggers.length > 0 && !triggers.some((t) => (row[t as keyof SkillTableRow] as number) > 0)) continue;
			if (usageFilter === "activated" && row.total === 0) continue;
			if (usageFilter === "never_used" && row.total !== 0) continue;
			if (q) {
				const candidates = [row.skillName, row.skillSource ?? "", ...row.marketplaces.map((m) => m.name)];
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
	}, [rows, debouncedSearch, sourceFilter, marketplaces, triggers, usageFilter, sortKey, sortDir]);

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

	const triggerOptions = TRIGGERS.map((t) => ({ value: t.key, label: t.label }));
	const marketplaceOptions = allMarketplaceNames.map((n) => ({ value: n, label: n }));

	const filtersActive =
		search !== "" ||
		sourceFilter !== "all" ||
		usageFilter !== "all" ||
		marketplaces.length > 0 ||
		triggers.length > 0;

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-lg font-semibold text-text-1">Skills</h1>
					<p className="text-sm text-text-3">
						All known skills, with activations in {PERIOD_LABEL[period]}.
					</p>
				</div>
				<SegmentedControl
					ariaLabel="Time range"
					value={period}
					onChange={setPeriod}
					options={PERIOD_OPTIONS}
				/>
			</div>

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
				<select
					value={sourceFilter}
					onChange={(e) => updateParam("source", e.target.value, "all")}
					className="rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-accent-bright"
				>
					<option value="all">Source: All</option>
					<option value="bundled">Bundled</option>
					<option value="external">External</option>
				</select>
				<select
					value={usageFilter}
					onChange={(e) => updateParam("usage", e.target.value, "all")}
					className="rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-accent-bright"
				>
					<option value="all">Usage: All</option>
					<option value="activated">Activated</option>
					<option value="never_used">Never used</option>
				</select>
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
					{marketplaces.map((m) => (
						<FilterPill
							key={`mp-${m}`}
							label={`Marketplace: ${m}`}
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

			<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-surface-800 border-b border-edge">
						<tr>
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
							<th className="text-left px-4 py-3 font-medium text-text-3">Trend</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Marketplaces</th>
							<th className="text-left px-4 py-3 font-medium text-text-3">Source</th>
							{TRIGGERS.map(({ key, label, color }) => (
								<SortableHeader
									key={key}
									label={
										<span className="flex items-center gap-1.5">
											<span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
											{label}
										</span>
									}
									sortKey={key}
									currentKey={sortKey}
									currentDir={sortDir}
									onSort={toggleSort}
									className="min-w-32 text-left"
								/>
							))}
						</tr>
					</thead>
					<tbody>
						{loading ? (
							SKELETON_KEYS.map((k) => <SkeletonRow key={k} />)
						) : error ? (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center text-danger text-sm">
									{error}
								</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-12 text-center text-text-3 text-sm">
									No skills found.
								</td>
							</tr>
						) : filteredRows.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center text-text-4 text-sm">
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
							filteredRows.map((row) => (
								<tr
									key={row.skillName}
									onClick={() => setOpenSkill(row.skillName)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setOpenSkill(row.skillName);
										}
									}}
									tabIndex={0}
									className={cn(
										"border-b border-edge-dim hover:bg-surface-800 transition-colors cursor-pointer focus:outline-none focus:bg-surface-800",
										row.total === 0 && "opacity-60",
									)}
								>
									<td className="px-4 py-3 font-mono text-text-1">
										<span className="flex items-center gap-2">
											{row.skillName}
											{row.status === "removed" && (
												<span className="inline-flex items-center rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-400">
													Removed
												</span>
											)}
											{row.total === 0 && (
												<span className="inline-flex items-center rounded border border-edge bg-surface-800 px-1.5 py-0.5 text-xs text-text-3">
													Never used
												</span>
											)}
										</span>
									</td>
									<td className="px-4 py-3 text-right text-text-2 tabular-nums">{row.total}</td>
									<td className="px-4 py-3">
										<Sparkline values={row.dailyCounts} width={80} height={20} />
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
											<span className="inline-flex items-center rounded border border-accent-soft/30 bg-accent-soft/15 px-1.5 py-0.5 text-xs font-medium text-accent-soft">
												Bundled
											</span>
										) : (
											<span className="text-text-4">—</span>
										)}
									</td>
									{TRIGGERS.map(({ key, color }) => (
										<ProgressCell key={key} count={row[key]} total={row.total} color={color} />
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<SkillDetailDrawer
				skillName={openSkill}
				period={period}
				onClose={() => setOpenSkill(null)}
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
		<tr className="border-b border-edge-dim">
			<td className="px-4 py-3">
				<div className="h-3 w-44 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3 text-right">
				<div className="ml-auto h-3 w-10 rounded bg-surface-800 animate-pulse" />
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
			{TRIGGERS.map(({ key }) => (
				<td key={key} className="px-4 py-3">
					<div className="h-3 w-full rounded bg-surface-800 animate-pulse" />
				</td>
			))}
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
