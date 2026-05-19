import { MarketplaceBadge } from "@/components/marketplaces/MarketplaceBadge";
import { PluginChip } from "@/components/skills/PluginChip";
import { SkillDetailDrawer } from "@/components/skills/SkillDetailDrawer";
import { SkillStatStrip } from "@/components/skills/SkillStatStrip";
import { TrendSparkline } from "@/components/skills/TrendSparkline";
import {
	Button,
	ConfirmDialog,
	IncludeIgnoredToggle,
	MultiSelect,
	PageHeader,
	SearchBar,
	SegmentedControl,
	SingleSelect,
	StatusChip,
	type StatusChipOption,
	StatusFilter,
	TBody,
	THead,
	Table,
} from "@/components/ui";
import { api } from "@/lib/api";
import { fuzzyScore } from "@/lib/fuzzy";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useIncludeIgnored } from "@/lib/use-include-ignored";
import { useStatusFilter } from "@/lib/use-status-filter";
import { cn, computeDeltaPct } from "@/lib/utils";
import {
	type DashboardPeriod,
	type PeriodFilter,
	SKILL_SOURCES,
	SKILL_SOURCE_LABELS,
	SKILL_STATUSES,
	type SkillSource,
	type SkillStatus,
	type SkillTableRow,
	isBundledSource,
	isKnownSkillSource,
} from "@/types/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";

const SKILL_STATUS_CHIP_OPTIONS: readonly StatusChipOption<SkillStatus>[] = [
	{ value: "approved", label: "Approved", tone: "success" },
	{ value: "to_review", label: "To review", tone: "warning" },
	{ value: "removed", label: "Removed", tone: "danger" },
	{ value: "denied", label: "Denied", tone: "danger" },
	{ value: "ignored", label: "Ignored", tone: "neutral" },
];

const TRIGGERS: {
	key: "userSlash" | "claudeProactive" | "nestedSkill";
	label: string;
	hint: string;
	swatch: string;
	gradient: string;
}[] = [
	{
		key: "userSlash",
		label: "user-slash",
		hint: "Invoked via /skill in chat",
		swatch: "bg-accent-bright",
		gradient: "linear-gradient(90deg, var(--color-accent), var(--color-accent-bright))",
	},
	{
		key: "claudeProactive",
		label: "claude-proactive",
		hint: "Claude chose to load it",
		swatch: "bg-accent-2",
		gradient: "linear-gradient(90deg, var(--color-accent-2), var(--color-accent-2-soft))",
	},
	{
		key: "nestedSkill",
		label: "nested-skill",
		hint: "Loaded by another skill",
		swatch: "bg-warning",
		gradient: "linear-gradient(90deg, var(--color-warning), var(--color-caution))",
	},
];

const UNKNOWN_TRIGGER = {
	key: "unknown" as const,
	label: "unknown",
	hint: "Claude Code didn't record what triggered it",
	swatch: "bg-text-4",
	gradient: "linear-gradient(90deg, var(--color-text-4), var(--color-edge-bright))",
};

const TRIG_TIP_WIDTH = 460;
const TRIG_TIP_MARGIN = 12;

function TriggerMixCell({ row }: { row: SkillTableRow }) {
	const unknown = Math.max(0, row.total - row.userSlash - row.claudeProactive - row.nestedSkill);
	const segments: {
		key: string;
		label: string;
		hint: string;
		swatch: string;
		gradient: string;
		value: number;
	}[] = [
		...TRIGGERS.map((t) => ({ ...t, value: row[t.key] })),
		...(unknown > 0 ? [{ ...UNKNOWN_TRIGGER, value: unknown }] : []),
	];
	const sum = Math.max(1, row.total);
	const wrapRef = useRef<HTMLDivElement>(null);
	const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);

	const computePosition = () => {
		const el = wrapRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const width = Math.min(TRIG_TIP_WIDTH, vw - TRIG_TIP_MARGIN * 2);
		// Anchor to right edge of trigger, clamp inside viewport.
		let left = rect.right - width;
		left = Math.max(TRIG_TIP_MARGIN, Math.min(left, vw - width - TRIG_TIP_MARGIN));
		// Below by default; flip above if not enough room.
		const belowTop = rect.bottom + 8;
		const approxHeight = 220;
		const top =
			belowTop + approxHeight > vh - TRIG_TIP_MARGIN &&
			rect.top - 8 - approxHeight > TRIG_TIP_MARGIN
				? rect.top - 8 - approxHeight
				: belowTop;
		setTipPos({ left, top });
	};

	useEffect(() => {
		if (!tipPos) return;
		const onScroll = () => setTipPos(null);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);
		return () => {
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
		};
	}, [tipPos]);

	return (
		<td className="px-4 py-3">
			<div
				ref={wrapRef}
				className="relative inline-block"
				onMouseEnter={computePosition}
				onMouseLeave={() => setTipPos(null)}
			>
				<div className="flex h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-700">
					{segments.map((s) => (
						<div
							key={s.key}
							className="h-full"
							style={{ width: `${(s.value / sum) * 100}%`, background: s.gradient }}
						/>
					))}
				</div>
				<div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-text-4">
					{segments.map((s) => (
						<span key={s.key} className="inline-flex items-center gap-1">
							<span className={cn("inline-block h-1.5 w-1.5 rounded-sm", s.swatch)} />
							{s.value}
						</span>
					))}
				</div>
			</div>
			{tipPos &&
				createPortal(
					<div
						role="tooltip"
						className="pointer-events-none fixed z-50 rounded-[10px] border border-edge bg-surface-800 px-[18px] py-4 shadow-[0_18px_44px_rgba(0,0,0,0.7)]"
						style={{
							left: tipPos.left,
							top: tipPos.top,
							width: Math.min(TRIG_TIP_WIDTH, window.innerWidth - TRIG_TIP_MARGIN * 2),
							boxShadow:
								"0 18px 44px rgba(0,0,0,0.7), 0 0 0 1px color-mix(in srgb, var(--color-accent-bright) 8%, transparent)",
						}}
					>
						<div className="mb-2 border-b border-edge-dim pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
							Trigger mix · {row.total.toLocaleString("en-US")} total
						</div>
						{segments.map((s, i) => {
							const pct = ((s.value / sum) * 100).toFixed(0);
							return (
								<div
									key={s.key}
									className={cn(
										"grid items-center gap-3 py-2.5 font-mono text-[13px]",
										i > 0 && "border-t border-dashed border-edge-dim",
									)}
									style={{ gridTemplateColumns: "12px 150px 1fr 64px 48px" }}
								>
									<span className="h-3 w-3 rounded-[3px]" style={{ background: s.gradient }} />
									<span className="text-text-1">{s.label}</span>
									<span className="font-sans text-[13px] leading-snug text-text-3">{s.hint}</span>
									<span className="text-right text-[14px] tabular-nums text-text-1">
										{s.value.toLocaleString("en-US")}
									</span>
									<span className="text-right tabular-nums text-text-3">{pct}%</span>
								</div>
							);
						})}
					</div>,
					document.body,
				)}
		</td>
	);
}

const NO_SOURCE_FILTER = "__none__";
type SourceFilter = "all" | SkillSource | typeof NO_SOURCE_FILTER;
type UsageFilter = "all" | "activated" | "never_used";
type PluginLinkFilter = "all" | "linked" | "orphan";
type SortKey =
	| "skillName"
	| "total"
	| "uniqueUsers"
	| "uniqueSessions"
	| "pluginUniqueLoaders"
	| "status"
	| "userSlash"
	| "claudeProactive"
	| "nestedSkill"
	| "lastSeenAt";
type SortDir = "asc" | "desc";

const SOURCE_VALUES: SourceFilter[] = ["all", ...SKILL_SOURCES, NO_SOURCE_FILTER];
const USAGE_VALUES: UsageFilter[] = ["all", "activated", "never_used"];
const PLUGIN_LINK_VALUES: PluginLinkFilter[] = ["all", "linked", "orphan"];
const SORT_KEYS: SortKey[] = [
	"skillName",
	"total",
	"uniqueUsers",
	"uniqueSessions",
	"pluginUniqueLoaders",
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
const NO_PLUGIN_FILTER = "__no_plugin__";
const NO_PLUGIN_LABEL = "(none)";

function rowKey(row: { skillName: string; pluginName: string | null }): string {
	return `${row.skillName}::${row.pluginName ?? NO_PLUGIN_KEY}`;
}

function keyToEntry(key: string): { skillName: string; pluginName: string } {
	const idx = key.indexOf("::");
	const skillName = key.slice(0, idx);
	const pluginPart = key.slice(idx + 2);
	return { skillName, pluginName: pluginPart === NO_PLUGIN_KEY ? "" : pluginPart };
}

type PeriodValue = DashboardPeriod | "custom";

const PERIOD_OPTIONS: { value: PeriodValue; label: string }[] = [
	{ value: 7, label: "7d" },
	{ value: 30, label: "30d" },
	{ value: 90, label: "90d" },
	{ value: "all", label: "All" },
	{ value: "custom", label: "Custom" },
];

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
	7: "the last 7 days",
	30: "the last 30 days",
	90: "the last 90 days",
	all: "all time",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayYmd(): string {
	return new Date().toISOString().slice(0, 10);
}

function daysAgoYmd(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

function pick<T extends string>(raw: string | null, values: readonly T[], fallback: T): T {
	return values.includes((raw ?? "") as T) ? (raw as T) : fallback;
}

function pickPeriodValue(raw: string | null): PeriodValue {
	if (raw === "all") return "all";
	if (raw === "custom") return "custom";
	const n = Number.parseInt(raw ?? "", 10);
	if (n === 7 || n === 30 || n === 90) return n;
	return 30;
}

function pickPeriodFilter(
	periodValue: PeriodValue,
	fromRaw: string | null,
	toRaw: string | null,
): PeriodFilter {
	if (periodValue === "custom") {
		const from = fromRaw && ISO_DATE_RE.test(fromRaw) ? fromRaw : daysAgoYmd(30);
		const to = toRaw && ISO_DATE_RE.test(toRaw) ? toRaw : todayYmd();
		return { kind: "range", from, to };
	}
	return { kind: "preset", days: periodValue };
}

function describePeriodFilter(filter: PeriodFilter): string {
	if (filter.kind === "preset") return PERIOD_LABEL[filter.days];
	return `${filter.from} → ${filter.to}`;
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
	const navigate = useNavigate();
	const [openSkill, setOpenSkill] = useState<string | null>(null);
	const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const [bulkStatusResult, setBulkStatusResult] = useState<{
		updated: number;
		skippedInherited: number;
		notFound: number;
	} | null>(null);
	const [bulkStatusError, setBulkStatusError] = useState<string | null>(null);
	const selectAllRef = useRef<HTMLInputElement>(null);

	const periodValue = pickPeriodValue(searchParams.get("period"));
	const periodFilter = pickPeriodFilter(
		periodValue,
		searchParams.get("from"),
		searchParams.get("to"),
	);
	const search = searchParams.get("search") ?? "";
	const sourceFilter = pick<SourceFilter>(searchParams.get("source"), SOURCE_VALUES, "all");
	const usageFilter = pick<UsageFilter>(searchParams.get("usage"), USAGE_VALUES, "all");
	const pluginLinkFilter = pick<PluginLinkFilter>(
		searchParams.get("pluginLink"),
		PLUGIN_LINK_VALUES,
		"all",
	);
	const approvedOnly = searchParams.get("approvedMp") === "1";
	const activeOnly = searchParams.get("activeWindow") === "1";
	const soloOnly = searchParams.get("solo") === "1";
	const sortKey = pick<SortKey>(searchParams.get("sort"), SORT_KEYS, "total");
	const sortDir: SortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
	const { status: statusFilter, setStatus } = useStatusFilter<SkillStatus>(
		"status",
		SKILL_STATUSES,
	);
	const { includeIgnored, setIncludeIgnored } = useIncludeIgnored();

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

	const allPluginNames = useMemo(() => {
		const names = new Set<string>();
		for (const row of rows) {
			if (row.pluginName) names.add(row.pluginName);
		}
		return Array.from(names).sort();
	}, [rows]);

	const pluginFilterValues = useMemo(() => [...allPluginNames, NO_PLUGIN_FILTER], [allPluginNames]);
	const plugins = pickList(searchParams.get("plugin"), pluginFilterValues);

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

	function setPeriod(value: PeriodValue) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (value === "custom") {
					next.set("period", "custom");
					if (!next.get("from")) next.set("from", daysAgoYmd(30));
					if (!next.get("to")) next.set("to", todayYmd());
				} else {
					if (value === 30) next.delete("period");
					else next.set("period", String(value));
					next.delete("from");
					next.delete("to");
				}
				return next;
			},
			{ replace: true },
		);
	}

	function setRangeBound(key: "from" | "to", value: string) {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set("period", "custom");
				next.set(key, value);
				if (!next.get("from")) next.set("from", daysAgoYmd(30));
				if (!next.get("to")) next.set("to", todayYmd());
				return next;
			},
			{ replace: true },
		);
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

	async function handleStatusChange(skillName: string, pluginName: string, status: SkillStatus) {
		setRows((prev) =>
			prev.map((r) =>
				r.skillName === skillName && (r.pluginName ?? "") === pluginName ? { ...r, status } : r,
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
				for (const k of ["period", "from", "to"]) {
					const v = prev.get(k);
					if (v) next.set(k, v);
				}
				return next;
			},
			{ replace: true },
		);
	}

	const periodFilterKey =
		periodFilter.kind === "preset"
			? `preset:${periodFilter.days}`
			: `range:${periodFilter.from}:${periodFilter.to}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is a manual refetch trigger
	useEffect(() => {
		setLoading(true);
		setError(null);
		let cancelled = false;
		api.skills
			.table(periodFilter, { includeIgnored })
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
	}, [periodFilterKey, reloadToken, includeIgnored]);

	useEffect(() => {
		function onVisibilityChange() {
			if (document.visibilityState === "visible") setReloadToken((n) => n + 1);
		}
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	const filteredRows = useMemo(() => {
		const q = debouncedSearch.trim();
		const scored: { row: SkillTableRow; score: number }[] = [];
		for (const row of rows) {
			if (pluginLinkFilter === "linked" && !row.pluginName) continue;
			if (pluginLinkFilter === "orphan" && row.pluginName) continue;
			if (approvedOnly && !row.marketplaces.some((m) => m.status === "approved")) continue;
			if (activeOnly && row.total === 0) continue;
			if (soloOnly && !(row.uniqueUsers === 1 && row.total > 0)) continue;
			if (plugins.length > 0) {
				const wantsNone = plugins.includes(NO_PLUGIN_FILTER);
				const wantedNames = plugins.filter((p) => p !== NO_PLUGIN_FILTER);
				const hasNone = !row.pluginName;
				const matchesNamed = !!row.pluginName && wantedNames.includes(row.pluginName);
				if (!((wantsNone && hasNone) || matchesNamed)) continue;
			}
			if (sourceFilter !== "all") {
				if (sourceFilter === NO_SOURCE_FILTER) {
					if (row.skillSource !== null) continue;
				} else if (row.skillSource !== sourceFilter) continue;
			}
			if (statusFilter !== "all" && (row.status ?? "to_review") !== statusFilter) continue;
			if (marketplaces.length > 0) {
				const wantsNone = marketplaces.includes(NO_MARKETPLACE);
				const wantedNames = marketplaces.filter((m) => m !== NO_MARKETPLACE);
				const hasNone = row.marketplaces.length === 0;
				const matchesNamed = row.marketplaces.some((mp) => wantedNames.includes(mp.name));
				if (!((wantsNone && hasNone) || matchesNamed)) continue;
			}
			if (
				triggers.length > 0 &&
				!triggers.some((t) => (row[t as keyof SkillTableRow] as number) > 0)
			)
				continue;
			// "Activated" / "Never used" are lifetime semantics — gated on
			// lastSeenAt (which the backend now computes without a time filter),
			// not on the windowed `total`. Otherwise a heavily-used skill with no
			// events in the selected period would be miscategorized as "never used".
			if (usageFilter === "activated" && row.lastSeenAt === null) continue;
			if (usageFilter === "never_used" && row.lastSeenAt !== null) continue;
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
				const av = a.row[sortKey] as string | number | null;
				const bv = b.row[sortKey] as string | number | null;
				if (typeof av === "string" && typeof bv === "string") {
					return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
				}
				// Treat nulls (e.g. pluginUniqueLoaders on bundled rows) as -1 so
				// they cluster at one end consistently.
				const an = av == null ? -1 : (av as number);
				const bn = bv == null ? -1 : (bv as number);
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
		plugins,
		pluginLinkFilter,
		approvedOnly,
		activeOnly,
		soloOnly,
	]);

	const stats = useMemo(() => {
		const total = filteredRows.length;
		let linked = 0;
		let inApproved = 0;
		let activeInWindow = 0;
		let soloUser = 0;
		for (const row of filteredRows) {
			if (row.pluginName) linked++;
			if (row.marketplaces.some((m) => m.status === "approved")) inApproved++;
			if (row.total > 0) activeInWindow++;
			if (row.uniqueUsers === 1 && row.total > 0) soloUser++;
		}
		return { total, linked, orphan: total - linked, inApproved, activeInWindow, soloUser };
	}, [filteredRows]);

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

	function handleViewCohorts() {
		const names = new Set<string>();
		for (const key of selectedKeys) {
			const name = key.split("::")[0];
			if (name) names.add(name);
		}
		if (names.size === 0) return;
		const skills = [...names].sort().join(",");
		navigate(`/cohorts?skills=${encodeURIComponent(skills)}`);
	}

	useEffect(() => {
		if (!bulkStatusResult && !bulkStatusError) return;
		const id = setTimeout(() => {
			setBulkStatusResult(null);
			setBulkStatusError(null);
		}, 6000);
		return () => clearTimeout(id);
	}, [bulkStatusResult, bulkStatusError]);

	const editableSelectedCount = useMemo(() => {
		let n = 0;
		for (const k of selectedKeys) {
			if (keyToEntry(k).pluginName === "") n++;
		}
		return n;
	}, [selectedKeys]);

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

	async function handleBulkStatus(status: SkillStatus) {
		const entries = Array.from(selectedKeys).map(keyToEntry);
		if (entries.length === 0) return;
		setBulkStatusError(null);
		setBulkStatusResult(null);

		setRows((prev) =>
			prev.map((r) =>
				selectedKeys.has(rowKey(r)) && (r.pluginName ?? "") === "" ? { ...r, status } : r,
			),
		);

		try {
			const result = await api.skills.updateStatusBulk({ skills: entries, status });
			setBulkStatusResult(result);
			setSelectedKeys(new Set());
		} catch (e) {
			setBulkStatusError(e instanceof Error ? e.message : String(e));
			setReloadToken((t) => t + 1);
		}
	}

	const triggerOptions = TRIGGERS.map((t) => ({ value: t.key, label: t.label }));
	const marketplaceOptions = [
		...allMarketplaceNames.map((n) => ({ value: n, label: n })),
		{ value: NO_MARKETPLACE, label: NO_MARKETPLACE_LABEL },
	];
	const pluginOptions = [
		...allPluginNames.map((n) => ({ value: n, label: n })),
		{ value: NO_PLUGIN_FILTER, label: NO_PLUGIN_LABEL },
	];

	const filtersActive =
		search !== "" ||
		sourceFilter !== "all" ||
		usageFilter !== "all" ||
		statusFilter !== "all" ||
		marketplaces.length > 0 ||
		triggers.length > 0 ||
		plugins.length > 0 ||
		pluginLinkFilter !== "all" ||
		approvedOnly ||
		activeOnly ||
		soloOnly;

	const isLeastUsedPreset = usageFilter === "activated" && sortKey === "total" && sortDir === "asc";

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
				title={loading ? "Skills" : `Skills (${rows.length})`}
				subtitle={`All known skills, with activations in ${describePeriodFilter(periodFilter)}.`}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<SegmentedControl
							ariaLabel="Time range"
							value={periodValue}
							onChange={setPeriod}
							options={PERIOD_OPTIONS}
						/>
						{periodFilter.kind === "range" && (
							<div className="flex items-center gap-1">
								<input
									type="date"
									aria-label="From date"
									value={periodFilter.from}
									max={periodFilter.to}
									onChange={(e) => setRangeBound("from", e.target.value)}
									className="rounded border border-edge bg-surface-800 px-2 py-1 font-mono text-xs text-text-1"
								/>
								<span className="text-text-4 text-xs">→</span>
								<input
									type="date"
									aria-label="To date"
									value={periodFilter.to}
									min={periodFilter.from}
									max={todayYmd()}
									onChange={(e) => setRangeBound("to", e.target.value)}
									className="rounded border border-edge bg-surface-800 px-2 py-1 font-mono text-xs text-text-1"
								/>
							</div>
						)}
					</div>
				}
			/>

			<SkillStatStrip
				total={stats.total}
				linked={stats.linked}
				orphan={stats.orphan}
				inApproved={stats.inApproved}
				activeInWindow={stats.activeInWindow}
				soloUser={stats.soloUser}
				pluginLink={pluginLinkFilter}
				onTogglePluginLink={(next) => updateParam("pluginLink", next, "all")}
				approvedOnly={approvedOnly}
				onToggleApproved={() => updateParam("approvedMp", approvedOnly ? "" : "1", "")}
				activeOnly={activeOnly}
				onToggleActive={() => updateParam("activeWindow", activeOnly ? "" : "1", "")}
				soloOnly={soloOnly}
				onToggleSolo={() => updateParam("solo", soloOnly ? "" : "1", "")}
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
					label="Plugin"
					options={pluginOptions}
					values={plugins}
					onChange={(v) => setListParam("plugin", v)}
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
				<SingleSelect<SourceFilter>
					label="Source"
					value={sourceFilter}
					onChange={(v) => updateParam("source", v, "all")}
					options={[
						{ value: "all", label: "All" },
						...SKILL_SOURCES.map((s) => ({ value: s, label: SKILL_SOURCE_LABELS[s] })),
						{ value: NO_SOURCE_FILTER, label: "(none)" },
					]}
				/>
				<SingleSelect<UsageFilter>
					label="Usage"
					value={usageFilter}
					onChange={(v) => updateParam("usage", v, "all")}
					options={[
						{ value: "all", label: "All" },
						{ value: "activated", label: "Activated" },
						{ value: "never_used", label: "Never used" },
					]}
				/>
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
				<IncludeIgnoredToggle value={includeIgnored} onChange={setIncludeIgnored} />
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
					{pluginLinkFilter !== "all" && (
						<FilterPill
							label={`Plugin link: ${pluginLinkFilter === "linked" ? "linked" : "not in plugin"}`}
							onRemove={() => updateParam("pluginLink", "", "all")}
						/>
					)}
					{approvedOnly && (
						<FilterPill
							label="Marketplace: approved"
							onRemove={() => updateParam("approvedMp", "", "")}
						/>
					)}
					{activeOnly && (
						<FilterPill
							label="Active in window"
							onRemove={() => updateParam("activeWindow", "", "")}
						/>
					)}
					{soloOnly && (
						<FilterPill label="Solo-user skills" onRemove={() => updateParam("solo", "", "")} />
					)}
					{plugins.map((p) => (
						<FilterPill
							key={`pl-${p}`}
							label={`Plugin: ${p === NO_PLUGIN_FILTER ? NO_PLUGIN_LABEL : p}`}
							onRemove={() =>
								setListParam(
									"plugin",
									plugins.filter((x) => x !== p),
								)
							}
						/>
					))}
					{sourceFilter !== "all" && (
						<FilterPill
							label={`Source: ${
								sourceFilter === NO_SOURCE_FILTER ? "(none)" : SKILL_SOURCE_LABELS[sourceFilter]
							}`}
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
							onRemove={() =>
								setListParam(
									"marketplace",
									marketplaces.filter((x) => x !== m),
								)
							}
						/>
					))}
					{triggers.map((t) => (
						<FilterPill
							key={`tr-${t}`}
							label={`Trigger: ${TRIGGERS.find((tr) => tr.key === t)?.label ?? t}`}
							onRemove={() =>
								setListParam(
									"trigger",
									triggers.filter((x) => x !== t),
								)
							}
						/>
					))}
				</div>
			)}

			{selectedKeys.size > 0 && (
				<div className="flex flex-wrap items-center gap-3 rounded-md border border-accent-bright/30 bg-accent-bright/10 px-3 py-2 text-sm text-text-1">
					<span className="flex items-center gap-2">
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
					</span>
					<span className="h-5 border-l border-edge" aria-hidden />
					<div className="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={handleViewCohorts}
							title="Open the Cohorts page filtered to the selected skills"
						>
							View cohorts
						</Button>
						<StatusChip<SkillStatus>
							value={"" as SkillStatus}
							options={SKILL_STATUS_CHIP_OPTIONS}
							placeholderLabel="Set status…"
							onChange={(v) => handleBulkStatus(v)}
							disabled={editableSelectedCount === 0}
							ariaLabel="Set status for selected skills"
							title={
								editableSelectedCount === 0
									? "All selected skills inherit their status from a plugin"
									: editableSelectedCount < selectedKeys.size
										? `${editableSelectedCount} of ${selectedKeys.size} selected can be updated — the rest inherit from a plugin`
										: undefined
							}
							align="right"
							size="md"
						/>
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

			{(bulkStatusResult || bulkStatusError) && (
				<output
					className={cn(
						"block rounded-md border px-3 py-2 text-sm",
						bulkStatusError
							? "border-danger/30 bg-danger/10 text-danger"
							: "border-accent-bright/30 bg-accent-bright/10 text-text-1",
					)}
				>
					{bulkStatusError ? (
						<>Failed to update status: {bulkStatusError}</>
					) : bulkStatusResult ? (
						<>
							Updated <span className="font-medium">{bulkStatusResult.updated}</span>
							{bulkStatusResult.skippedInherited > 0 && (
								<>
									{" · "}
									<span className="text-text-3">
										{bulkStatusResult.skippedInherited} skipped (inherited from plugin)
									</span>
								</>
							)}
							{bulkStatusResult.notFound > 0 && (
								<>
									{" · "}
									<span className="text-text-3">{bulkStatusResult.notFound} not found</span>
								</>
							)}
						</>
					) : null}
				</output>
			)}

			<Table>
				<THead>
					<tr>
						<th className="h-9 w-10 px-3">
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
							title="Total activations of this skill over the selected period"
						/>
						<SortableHeader
							label="Users"
							sortKey="uniqueUsers"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-right"
							title="Distinct users who activated this skill"
						/>
						<SortableHeader
							label="Sessions"
							sortKey="uniqueSessions"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-right"
							title="Distinct Claude Code sessions in which this skill was activated"
						/>
						<SortableHeader
							label="Loaders"
							sortKey="pluginUniqueLoaders"
							currentKey={sortKey}
							currentDir={sortDir}
							onSort={toggleSort}
							className="text-right"
							title="Distinct users who loaded the plugin that ships this skill"
						/>
						<th
							className="h-9 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-text-4"
							title="Change in activations vs the preceding equal-length period"
						>
							Δ
						</th>
						<th
							className="h-9 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-text-4"
							title="Daily activations over the selected period"
						>
							Trend
						</th>
						<th className="h-9 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-text-4">
							Marketplaces
						</th>
						<th
							className="h-9 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-text-4"
							title="Where this skill comes from (bundled, plugin marketplace, or unknown)"
						>
							Source
						</th>
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
						<th
							className="h-9 min-w-44 px-4 text-left font-mono text-[10px] uppercase tracking-wider text-text-4"
							title="Share of activations by trigger type"
						>
							Trigger mix
						</th>
					</tr>
				</THead>
				<TBody>
					{loading ? (
						SKELETON_KEYS.map((k) => <SkeletonRow key={k} />)
					) : error ? (
						<tr>
							<td colSpan={12} className="px-4 py-8 text-center text-danger text-sm">
								{error}
							</td>
						</tr>
					) : rows.length === 0 ? (
						<tr>
							<td colSpan={12} className="px-4 py-12 text-center text-text-3 text-sm">
								No skills found.
							</td>
						</tr>
					) : filteredRows.length === 0 ? (
						<tr>
							<td colSpan={12} className="px-4 py-8 text-center text-text-4 text-sm">
								{statusFilter === "ignored" && !includeIgnored ? (
									"Ignored skills are hidden. Enable 'Include ignored' to view them."
								) : (
									<>
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
										{(() => {
											const showPluginChip =
												!!row.pluginName && row.skillName.includes(":");
											const displayName =
												showPluginChip && row.pluginName
													? row.skillName.startsWith(`${row.pluginName}:`)
														? row.skillName.slice(row.pluginName.length + 1)
														: row.skillName
													: row.skillName;
											return (
												<div className="flex min-w-0 flex-col gap-1.5">
													<span className="flex items-center gap-2">
														{displayName}
														{row.lastSeenAt === null && (
															<span className="inline-flex items-center rounded border border-edge bg-surface-800 px-1.5 py-0.5 text-xs text-text-3">
																Never used
															</span>
														)}
													</span>
													{showPluginChip && row.pluginName && (
														<PluginChip
															pluginName={row.pluginName}
															onFilter={(name) => setListParam("plugin", [name])}
														/>
													)}
												</div>
											);
										})()}
									</td>
									<td className="px-4 py-3 text-right font-mono text-text-1 tabular-nums">
										{row.total.toLocaleString("en-US")}
									</td>
									<td className="px-4 py-3 text-right font-mono tabular-nums">
										{row.uniqueUsers > 0 ? (
											<span className="text-text-1">{row.uniqueUsers.toLocaleString("en-US")}</span>
										) : (
											<span className="text-text-4">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-right font-mono tabular-nums">
										{row.uniqueSessions > 0 ? (
											<span className="text-text-1">{row.uniqueSessions.toLocaleString("en-US")}</span>
										) : (
											<span className="text-text-4">—</span>
										)}
									</td>
									<td
										className="px-4 py-3 text-right font-mono tabular-nums"
										title={
											row.pluginUniqueLoaders == null
												? "Loader counts only apply to plugin-owned skills"
												: "Distinct users who loaded the plugin that ships this skill"
										}
									>
										{row.pluginUniqueLoaders == null ? (
											<span className="text-text-4">—</span>
										) : row.pluginUniqueLoaders > 0 ? (
											<span className="text-text-1">
												{row.pluginUniqueLoaders.toLocaleString("en-US")}
											</span>
										) : (
											<span className="text-text-4">0</span>
										)}
									</td>
									<td className="px-4 py-3">
										{(() => {
											// dailyCounts is capped at 90 days, so for the "All" preset the
											// Δ would silently mean "last 45d vs preceding 45d" — misleading.
											// Suppress it until we have lifetime daily aggregates.
											const isAllPreset =
												periodFilter.kind === "preset" && periodFilter.days === "all";
											if (isAllPreset)
												return <span className="font-mono text-[11px] text-text-4">·</span>;
											const pct = computeDeltaPct(row.dailyCounts);
											if (pct === 0)
												return <span className="font-mono text-[11px] text-text-4">·</span>;
											return (
												<span
													className={cn(
														"font-mono text-[11px]",
														pct > 0 ? "text-success" : "text-danger",
													)}
												>
													{pct > 0 ? `+${pct}%` : `${pct}%`}
												</span>
											);
										})()}
									</td>
									<td className="px-4 py-3">
										<TrendSparkline
											values={row.dailyCounts}
											width={80}
											height={20}
											strokeClass={row.total === 0 ? "stroke-text-4" : "stroke-accent-bright"}
											fillClass={row.total === 0 ? "fill-transparent" : "fill-accent-bright/15"}
											days={
												periodFilter.kind === "preset" && typeof periodFilter.days === "number"
													? periodFilter.days
													: row.dailyCounts.length
											}
										/>
									</td>
									<td className="px-4 py-3">
										{row.marketplaces.length > 0 ? (
											<div className="flex flex-wrap gap-1">
												{row.marketplaces.map((mp) => (
													<MarketplaceBadge
														key={mp.name}
														name={mp.name}
														status={mp.status}
														onClick={(e) => e.stopPropagation()}
													/>
												))}
											</div>
										) : (
											<span className="text-text-4">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										{isBundledSource(row.skillSource) ? (
											<span
												className="inline-flex cursor-help items-center rounded border border-accent-soft/30 bg-accent-bright/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-soft"
												title="Bundled skills ship inside Claude Code itself, so they are approved by default. You can still override their status manually."
											>
												{SKILL_SOURCE_LABELS.bundled.toLowerCase()}
											</span>
										) : isKnownSkillSource(row.skillSource) ? (
											<span className="font-mono text-[11px] text-text-4">
												{SKILL_SOURCE_LABELS[row.skillSource]}
											</span>
										) : (
											<span className="font-mono text-[11px] text-text-4">—</span>
										)}
									</td>
									<td
										className="px-4 py-3"
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
									>
										{(() => {
											const status = (row.status ?? "to_review") as SkillStatus;
											const pluginName = row.pluginName ?? "";
											const editable = pluginName === "";
											return (
												<StatusChip
													value={status}
													options={SKILL_STATUS_CHIP_OPTIONS}
													onChange={
														editable ? (v) => handleStatusChange(row.skillName, "", v) : undefined
													}
													disabled={!editable}
													ariaLabel={`Status for ${row.skillName}`}
													title={
														editable ? undefined : `Status inherited from plugin ${pluginName}`
													}
												/>
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
				period={periodFilter}
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
	title,
}: {
	label: React.ReactNode;
	sortKey: SortKey;
	currentKey: SortKey;
	currentDir: SortDir;
	onSort: (key: SortKey) => void;
	className?: string;
	title?: string;
}) {
	const active = sortKey === currentKey;
	return (
		<th
			className={cn(
				"h-9 px-4 font-mono text-[10px] uppercase tracking-wider text-text-4",
				className,
			)}
			title={title}
		>
			<button
				type="button"
				onClick={() => onSort(sortKey)}
				className={cn(
					"inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-text-1",
					active && "text-text-1",
				)}
			>
				{label}
				<span aria-hidden="true" className="text-[10px]">
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
			<td className="px-4 py-3 text-right">
				<div className="ml-auto h-3 w-8 rounded bg-surface-800 animate-pulse" />
			</td>
			<td className="px-4 py-3 text-right">
				<div className="ml-auto h-3 w-8 rounded bg-surface-800 animate-pulse" />
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
					<path
						d="M2 2l6 6M8 2L2 8"
						stroke="currentColor"
						strokeWidth="1.25"
						strokeLinecap="round"
					/>
				</svg>
			</button>
		</span>
	);
}
