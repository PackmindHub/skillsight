import { TrendSparkline } from "@/components/skills/TrendSparkline";
import { api } from "@/lib/api";
import { cn, computeDeltaPct, formatDate, isCurrentUtcMonth, sumKnownTriggers } from "@/lib/utils";
import type {
	DashboardPeriod,
	Marketplace,
	MonthlyTrendsResponse,
	Plugin,
	SkillTableRow,
	UsageResponse,
} from "@/types/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
	{ value: 7, label: "7d" },
	{ value: 30, label: "30d" },
	{ value: 90, label: "90d" },
	{ value: "all", label: "All" },
];

const PERIOD_DAYS: Record<Exclude<DashboardPeriod, "all">, number> = { 7: 7, 30: 30, 90: 90 };

function periodSubtitle(period: DashboardPeriod): string {
	if (period === "all") return "Skill activations across Claude Code clients · since launch";
	return `Skill activations across Claude Code clients · last ${PERIOD_DAYS[period]} days`;
}

function fmtCompact(n: number): string {
	if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function fmtFull(n: number): string {
	return n.toLocaleString("en-US");
}

function deltaPill(pct: number) {
	if (pct === 0) return { cls: "flat", label: "·" };
	if (pct > 0) return { cls: "up", label: `+${pct}%` };
	return { cls: "down", label: `${pct}%` };
}

interface MonthlyPoint {
	month: string;
	count: number;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
function formatMonth(iso: string): string {
	return monthFormatter.format(new Date(iso));
}

function formatMonthLabel(iso: string, now?: Date): string {
	return isCurrentUtcMonth(iso, now) ? `${formatMonth(iso)} (partial)` : formatMonth(iso);
}

type HeatCell = { date: string | null; count: number };

function Heatmap({ data }: { data: HeatCell[][] }) {
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	const max = Math.max(...data.flatMap((w) => w.map((c) => c.count)), 1);
	const weekKeys = data.map((week, wi) => `${wi}:${week.map((c) => c.count).join(",")}`);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{
		date: string;
		count: number;
		left: number;
		top: number;
		flip: boolean;
	} | null>(null);

	const positionFor = (
		target: HTMLElement,
		cell: HeatCell,
		row: number,
	): typeof hover => {
		if (!cell.date || !wrapperRef.current) return null;
		const cellRect = target.getBoundingClientRect();
		const wrapRect = wrapperRef.current.getBoundingClientRect();
		const flip = row === 0;
		return {
			date: cell.date,
			count: cell.count,
			left: cellRect.left - wrapRect.left + cellRect.width / 2,
			top: flip ? cellRect.bottom - wrapRect.top + 6 : cellRect.top - wrapRect.top - 6,
			flip,
		};
	};

	return (
		<div ref={wrapperRef} className="relative">
			<div className="flex flex-col gap-[3px] p-4 pt-2">
				{days.map((d, di) => (
					<div key={d} className="flex items-center gap-[3px]">
						<span className="w-7 font-mono text-[10px] text-text-4">{d}</span>
						{data.map((week, wi) => {
							const cell = week[di] ?? { date: null, count: 0 };
							const v = cell.count;
							const intensity = v / max;
							const isWeekend = di >= 5;
							const base = isWeekend ? "34, 211, 238" : "139, 92, 246";
							const op = 0.06 + intensity * 0.94;
							const hasData = cell.date != null;
							return (
								<button
									type="button"
									key={`${weekKeys[wi]}-${d}`}
									disabled={!hasData}
									aria-label={hasData ? `${formatDate(cell.date as string)}: ${v} activations` : "No data"}
									className="aspect-square flex-1 cursor-default appearance-none rounded-[3px] border-0 p-0 outline-none focus-visible:ring-1 focus-visible:ring-accent-bright"
									style={{
										maxWidth: 24,
										background: `rgba(${base}, ${op})`,
										boxShadow: intensity > 0.7 ? `0 0 6px rgba(${base}, ${op * 0.5})` : "none",
									}}
									onMouseEnter={(e) => setHover(positionFor(e.currentTarget, cell, di))}
									onMouseLeave={() => setHover(null)}
									onFocus={(e) => setHover(positionFor(e.currentTarget, cell, di))}
									onBlur={() => setHover(null)}
								/>
							);
						})}
					</div>
				))}
				<div className="mt-2 flex items-center gap-1.5 pl-[33px] font-mono text-[10px] text-text-4">
					<span>{data.length} weeks</span>
					<span className="ml-auto flex items-center gap-3">
						<span className="flex items-center gap-1.5">
							<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(34, 211, 238, 0.9)" }} />
							weekend
						</span>
						<span className="flex items-center gap-1.5">
							less
							<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.1)" }} />
							<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.35)" }} />
							<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.6)" }} />
							<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.9)" }} />
							more
						</span>
					</span>
				</div>
			</div>
			{hover && (
				<div
					role="tooltip"
					className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-edge bg-surface-700 px-2 py-1.5 text-[11px] shadow-lg"
					style={{
						left: hover.left,
						top: hover.top,
						transform: hover.flip ? "translate(-50%, 0)" : "translate(-50%, -100%)",
					}}
				>
					<div className="font-mono text-text-1">{formatDate(hover.date)}</div>
					<div className="font-mono text-text-3">{hover.count} activations</div>
				</div>
			)}
		</div>
	);
}

function buildHeatmap(dailyTrend: { date: string; count: number }[], weeks = 12): HeatCell[][] {
	// 12-week × 7-day grid. Rows are Mon..Sun, rightmost column = current ISO week.
	// Dates are UTC to match the backend's DATE_TRUNC('day', timestamp)::date output.
	const byDate = new Map<string, number>();
	for (const d of dailyTrend) byDate.set(d.date, d.count);
	const firstDataDate = dailyTrend[0]?.date ?? null;

	const now = new Date();
	const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const dow = today.getUTCDay(); // 0=Sun..6=Sat
	const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
	const endDate = new Date(today);
	endDate.setUTCDate(endDate.getUTCDate() + daysUntilSunday);
	const startDate = new Date(endDate);
	startDate.setUTCDate(startDate.getUTCDate() - (weeks * 7 - 1)); // a Monday

	const grid: HeatCell[][] = [];
	for (let w = 0; w < weeks; w++) {
		const week: HeatCell[] = [];
		for (let d = 0; d < 7; d++) {
			const cellDate = new Date(startDate);
			cellDate.setUTCDate(cellDate.getUTCDate() + w * 7 + d);
			const iso = cellDate.toISOString().slice(0, 10);
			if (cellDate > today || firstDataDate === null || iso < firstDataDate) {
				week.push({ date: null, count: 0 });
			} else {
				week.push({ date: iso, count: byDate.get(iso) ?? 0 });
			}
		}
		grid.push(week);
	}
	return grid;
}

function SegBtn({
	on,
	onClick,
	children,
}: {
	on?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-md border-0 bg-transparent px-3 py-1 text-[12px] text-text-3 transition-colors hover:text-text-1",
				on && "bg-surface-600 text-text-1 shadow-[inset_0_0_0_1px_var(--color-edge)]",
			)}
		>
			{children}
		</button>
	);
}

function Card({
	children,
	className,
	style,
}: {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div className={cn("card-glow", className)} style={style}>
			{children}
		</div>
	);
}

function CardHead({
	title,
	dotColor = "var(--color-accent-bright)",
	meta,
}: {
	title: React.ReactNode;
	dotColor?: string;
	meta?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between px-4 pb-2 pt-3.5">
			<h3 className="m-0 flex items-center gap-2 text-[13px] font-medium text-text-2">
				<span
					className="inline-block h-1.5 w-1.5 rounded-full"
					style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
				/>
				{title}
			</h3>
			{meta && <span className="font-mono text-[10px] text-text-4">{meta}</span>}
		</div>
	);
}

export default function DashboardPage() {
	const [period, setPeriod] = useState<DashboardPeriod>(30);
	const [usage, setUsage] = useState<UsageResponse | null>(null);
	const [rows, setRows] = useState<SkillTableRow[]>([]);
	const [totalMarketplaces, setTotalMarketplaces] = useState<number | null>(null);
	const [pendingMarketplaces, setPendingMarketplaces] = useState<number | null>(null);
	const [totalPlugins, setTotalPlugins] = useState<number | null>(null);
	const [pendingPlugins, setPendingPlugins] = useState<number | null>(null);
	const [pendingSkills, setPendingSkills] = useState<number | null>(null);
	const [monthly, setMonthly] = useState<MonthlyTrendsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Drop prior-period data so the loading state shows instead of stale numbers
		// under the newly selected chip.
		setUsage(null);
		setRows([]);
		setLoading(true);
		const periodFilter = { kind: "preset" as const, days: period };
		Promise.all([api.skills.usage(periodFilter), api.skills.table(periodFilter)])
			.then(([u, t]) => {
				if (cancelled) return;
				setUsage(u);
				setRows(t.rows);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(String(e));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [period]);

	useEffect(() => {
		api.marketplaces
			.list()
			.then(({ marketplaces }) => {
				const list = marketplaces as Marketplace[];
				setTotalMarketplaces(list.length);
				setPendingMarketplaces(list.filter((m) => m.status === "to_review").length);
			})
			.catch(() => {});
		api.plugins
			.list()
			.then(({ plugins }) => {
				const list = plugins as Plugin[];
				setTotalPlugins(list.length);
				setPendingPlugins(list.filter((p) => p.status === "to_review").length);
			})
			.catch(() => {});
		api.skills
			.table({ kind: "preset", days: "all" })
			.then(({ rows }) => setPendingSkills(rows.filter((r) => r.status === "to_review").length))
			.catch(() => {});
		api.skills
			.monthlyTrends()
			.then((m) => setMonthly(m))
			.catch(() => {});
	}, []);

	const movers = useMemo(() => {
		const decorated = rows
			.filter((r) => r.total > 0)
			.map((r) => ({ ...r, deltaPct: computeDeltaPct(r.dailyCounts) }));
		if (period === "all") {
			// "all time" Δ would be computed over the last 90d (sparkline cap),
			// which doesn't match the label. Fall back to top-by-total instead.
			return decorated.sort((a, b) => b.total - a.total).slice(0, 6);
		}
		return decorated.sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 6);
	}, [rows, period]);

	const heatmapData = useMemo(() => buildHeatmap(usage?.dailyTrend ?? [], 12), [usage]);

	// Sum per-event tallies from usage.byTrigger (not from `rows`): rows are
	// per-(skill, plugin) pairs and would double-count a skill registered under
	// multiple plugins. `byTrigger` is grouped by trigger over the same filtered
	// event set as totalActivations, so the segments add up to the total exactly.
	const triggerTotals = useMemo(() => sumKnownTriggers(usage?.byTrigger ?? []), [usage]);

	const uniqueKnownSkills = useMemo(
		() => new Set(rows.map((r) => r.skillName)).size,
		[rows],
	);

	const totalDaily = useMemo(() => (usage?.dailyTrend ?? []).map((d) => d.count), [usage]);

	const overallDelta = useMemo(() => computeDeltaPct(totalDaily), [totalDaily]);

	if (loading && !usage) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;
	if (!usage) return null;

	const triggerOther = Math.max(
		0,
		usage.stats.totalActivations - triggerTotals.user - triggerTotals.claude - triggerTotals.nested,
	);
	const triggerSum = Math.max(1, usage.stats.totalActivations);
	const heroDelta = deltaPill(overallDelta);
	const showDelta = period !== "all";

	return (
		<div className="space-y-[18px]">
			{/* Page head */}
			<header className="mb-[18px] flex flex-wrap items-end justify-between gap-6">
				<div className="min-w-0">
					<h1 className="m-0 flex flex-wrap items-baseline gap-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-text-1">
						Overview
						<span
							className="text-[30px]"
							style={{
								fontFamily: "var(--font-serif)",
								fontStyle: "italic",
								fontWeight: 400,
								color: "var(--color-accent-soft)",
							}}
						>
							at a glance
						</span>
					</h1>
					<p className="mt-1.5 text-[13px] text-text-3">{periodSubtitle(period)}</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex gap-[3px] rounded-lg border border-edge-dim bg-surface-800 p-[3px]">
						{PERIOD_OPTIONS.map((opt) => (
							<SegBtn key={String(opt.value)} on={opt.value === period} onClick={() => setPeriod(opt.value)}>
								{opt.label}
							</SegBtn>
						))}
					</div>
				</div>
			</header>

			{/* Hero */}
			<div className="grid gap-[18px]" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
				<div
					className="relative overflow-hidden rounded-[14px] border border-edge-dim px-6 py-5"
					style={{
						background:
							"radial-gradient(700px 240px at 0% 0%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%), linear-gradient(180deg, var(--color-surface-800), var(--color-surface-900))",
					}}
				>
					<div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
						Total activations · {period === "all" ? "all time" : `${PERIOD_DAYS[period]}d`}
					</div>
					<div className="mt-1.5 flex items-baseline gap-3.5 whitespace-nowrap text-[56px] font-semibold leading-none tracking-[-0.04em]">
						{fmtFull(usage.stats.totalActivations)}
						{showDelta && (
							<span
								className={cn(
									"rounded-full px-2.5 py-[3px] text-[13px] font-medium tracking-normal tabular-nums ring-1",
									heroDelta.cls === "up" && "bg-success/15 text-success ring-success/30",
									heroDelta.cls === "down" && "bg-danger/15 text-danger ring-danger/30",
									heroDelta.cls === "flat" && "bg-surface-700 text-text-2 ring-edge",
								)}
							>
								{heroDelta.label} vs prev
							</span>
						)}
					</div>
					<div className="mt-[18px] flex flex-wrap gap-[18px_28px]">
						<MiniStat
							label="Unique skills"
							value={
								<>
									{fmtFull(usage.stats.uniqueSkills)}
									<span className="ml-1 text-[11px] text-text-4">
										/ {uniqueKnownSkills > 0 ? fmtFull(uniqueKnownSkills) : "—"}
									</span>
								</>
							}
						/>
						<MiniStat label="Active users" value={fmtFull(usage.stats.activeUsers)} />
						<MiniStat label="Marketplaces" value={totalMarketplaces == null ? "—" : fmtFull(totalMarketplaces)} />
						<MiniStat label="Plugins" value={totalPlugins == null ? "—" : fmtFull(totalPlugins)} />
						<MiniStat
							label="Plugins loaded"
							value={fmtFull(usage.stats.uniqueLoadedPlugins ?? 0)}
						/>
						<MiniStat
							label="Plugin loaders"
							value={fmtFull(usage.stats.uniquePluginLoaders ?? 0)}
						/>
					</div>
					<div className="absolute -bottom-2.5 -right-2.5 h-[110px] w-[55%] overflow-hidden">
						{totalDaily.length > 0 && (
							<div className="absolute right-0 bottom-0">
								<TrendSparkline
									values={totalDaily}
									width={520}
									height={110}
									strokeClass="stroke-accent-bright"
									fillClass="fill-accent-bright/10"
									days={typeof period === "number" ? period : totalDaily.length}
								/>
							</div>
						)}
					</div>
				</div>

				<Card className="flex flex-col">
					<CardHead
						title={showDelta ? "Top movers" : "Top skills"}
						dotColor="var(--color-accent-2)"
						meta={showDelta ? `${PERIOD_DAYS[period as Exclude<DashboardPeriod, "all">]}d Δ` : "all time · by total"}
					/>
					<div className="px-4 pb-3.5">
						{movers.length === 0 ? (
							<p className="py-6 text-center text-[12px] text-text-4">
								{showDelta ? "No movers yet." : "No activations yet."}
							</p>
						) : (
							movers.map((m, i) => {
								const d = showDelta ? deltaPill(m.deltaPct) : null;
								return (
									<div
										key={`${m.skillName}-${m.pluginName ?? "none"}`}
										className="grid items-center gap-3.5 border-t border-edge-dim py-2 first:border-t-0"
										style={{ gridTemplateColumns: showDelta ? "auto 1fr auto auto" : "auto 1fr auto" }}
									>
										<span className="w-[18px] font-mono text-[11px] text-text-4">#{i + 1}</span>
										<div className="min-w-0">
											<div className="truncate font-mono text-[13px] text-text-1">{m.skillName}</div>
										</div>
										<span className="font-mono tabular-nums text-[13px] text-text-2">{fmtCompact(m.total)}</span>
										{showDelta && d && (
											<span
												className={cn(
													"rounded px-1.5 py-0.5 font-mono text-[11px]",
													d.cls === "up" && "bg-success/15 text-success",
													d.cls === "down" && "bg-danger/15 text-danger",
													d.cls === "flat" && "text-text-4",
												)}
											>
												{d.label}
											</span>
										)}
									</div>
								);
							})
						)}
					</div>
				</Card>
			</div>

			{/* KPI strip */}
			<div className="grid gap-[18px] grid-cols-2 md:grid-cols-4">
				<KpiCard
					label="Marketplaces to review"
					value={pendingMarketplaces ?? "—"}
					trailing={(pendingMarketplaces ?? 0) > 0 ? <span className="badge badge-warning">needs attention</span> : undefined}
					to="/marketplaces?status=to_review"
				/>
				<KpiCard
					label="Plugins to review"
					value={pendingPlugins ?? "—"}
					to="/plugins?status=to_review"
					highlight={(pendingPlugins ?? 0) > 0}
				/>
				<KpiCard
					label="Skills to review"
					value={pendingSkills ?? "—"}
					to="/skills?status=to_review"
					highlight={(pendingSkills ?? 0) > 0}
				/>
				<KpiCard
					label="Total events"
					value={fmtCompact(usage.stats.totalActivations)}
					trailing={<span className="text-[12px] text-text-4">last {period === "all" ? "all" : `${PERIOD_DAYS[period]}d`}</span>}
				/>
			</div>

			{/* Heatmap + By trigger */}
			<div className="grid gap-[18px] grid-cols-1 lg:grid-cols-2">
				<Card>
					<CardHead title="Activation density" meta={`${heatmapData.length}w · UTC`} />
					<Heatmap data={heatmapData} />
				</Card>
				<Card>
					<CardHead title="By trigger" meta={period === "all" ? "all time" : `${PERIOD_DAYS[period]}d`} />
					<div className="p-4 pt-1">
						<div className="flex h-3.5 w-full overflow-hidden rounded-md bg-surface-700">
							<div className="h-full" style={{ width: `${(triggerTotals.user / triggerSum) * 100}%`, background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-bright))" }} />
							<div className="h-full" style={{ width: `${(triggerTotals.claude / triggerSum) * 100}%`, background: "linear-gradient(90deg, var(--color-accent-2), var(--color-accent-2-soft))" }} />
							<div className="h-full" style={{ width: `${(triggerTotals.nested / triggerSum) * 100}%`, background: "linear-gradient(90deg, var(--color-warning), var(--color-caution))" }} />
							<div className="h-full" style={{ width: `${(triggerOther / triggerSum) * 100}%`, background: "linear-gradient(90deg, var(--color-text-4), var(--color-text-3))" }} />
						</div>
						<div className="mt-3.5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
							<TriggerStat label="user-slash" value={triggerTotals.user} pct={(triggerTotals.user / triggerSum) * 100} dotColor="var(--color-accent-bright)" />
							<TriggerStat label="claude-proactive" value={triggerTotals.claude} pct={(triggerTotals.claude / triggerSum) * 100} dotColor="var(--color-accent-2)" />
							<TriggerStat label="nested-skill" value={triggerTotals.nested} pct={(triggerTotals.nested / triggerSum) * 100} dotColor="var(--color-warning)" />
							<TriggerStat label="other" value={triggerOther} pct={(triggerOther / triggerSum) * 100} dotColor="var(--color-text-4)" />
						</div>
					</div>
				</Card>
			</div>

			{/* Monthly sparklines */}
			<div className="grid gap-[18px] grid-cols-1 md:grid-cols-3">
				<MonthlyCard
					title="Invocations / month"
					data={monthly?.invocations ?? []}
					color="var(--color-accent-bright)"
					valueLabel="invocations"
				/>
				<MonthlyCard
					title="Unique skills / month"
					data={monthly?.uniqueSkills ?? []}
					color="var(--color-accent-2)"
					valueLabel="unique skills"
				/>
				<MonthlyCard
					title="Active users / month"
					data={monthly?.uniqueUsers ?? []}
					color="var(--color-magenta)"
					valueLabel="active users"
				/>
			</div>

		</div>
	);
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="min-w-0 whitespace-nowrap leading-tight">
			<div className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-4">{label}</div>
			<div className="text-[18px] font-medium">{value}</div>
		</div>
	);
}

function KpiCard({
	label,
	value,
	to,
	trailing,
	highlight,
}: {
	label: string;
	value: React.ReactNode;
	to?: string;
	trailing?: React.ReactNode;
	highlight?: boolean;
}) {
	const className = cn(
		"card-glow block p-4",
		to && "transition-colors hover:border-accent-bright/40",
		highlight && "border-warning/40",
	);
	const content = (
		<>
			<div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-3">{label}</div>
			<div className="mt-1 flex items-baseline gap-2 text-[26px] font-semibold tracking-[-0.02em]">
				<span className={cn(highlight && "text-caution")}>{value}</span>
				{trailing}
			</div>
		</>
	);
	if (to) {
		return (
			<Link to={to} className={className}>
				{content}
			</Link>
		);
	}
	return <div className={className}>{content}</div>;
}

function TriggerStat({
	label,
	value,
	pct,
	dotColor,
}: {
	label: string;
	value: number;
	pct: number;
	dotColor: string;
}) {
	return (
		<div>
			<div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-4">
				<span className="inline-block h-2 w-2 rounded-sm" style={{ background: dotColor }} />
				{label}
			</div>
			<div className="mt-1 text-[20px] font-semibold">{fmtFull(value)}</div>
			<div className="font-mono text-[11px] text-text-3">{pct.toFixed(1)}%</div>
		</div>
	);
}

function MonthlyCard({
	title,
	data,
	color,
	valueLabel,
}: {
	title: string;
	data: MonthlyPoint[];
	color: string;
	valueLabel: string;
}) {
	return (
		<Card>
			<CardHead title={title} dotColor={color} meta="since launch" />
			<div className="p-4 pt-1">
				{data.length === 0 ? (
					<p className="py-6 text-center text-[12px] text-text-4">No data yet.</p>
				) : data.length === 1 ? (
					<div className="flex h-[88px] flex-col items-center justify-center gap-1">
						<div className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums" style={{ color }}>
							{fmtFull(data[0].count)}
						</div>
						<div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
							{valueLabel} · {formatMonthLabel(data[0].month)}
						</div>
					</div>
				) : (
					<>
						<InteractiveSparkline data={data} color={color} valueLabel={valueLabel} />
						<div className="mt-1.5 flex justify-between font-mono text-[10px] text-text-4">
							{data.map((d) => (
								<span key={d.month}>{formatMonthLabel(d.month)}</span>
							))}
						</div>
					</>
				)}
			</div>
		</Card>
	);
}

function InteractiveSparkline({
	data,
	color,
	valueLabel,
	width = 300,
	height = 64,
}: {
	data: MonthlyPoint[];
	color: string;
	valueLabel: string;
	width?: number;
	height?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [hover, setHover] = useState<{ idx: number; x: number; y: number; side: "left" | "right" } | null>(null);

	const values = data.map((d) => d.count);
	const max = Math.max(1, ...values);
	const points = values.map((v, i) => {
		const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2;
		const y = height - 1 - (v / max) * (height - 2);
		return [x, y] as const;
	});
	const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
	const areaPath = `${linePath} L ${(points[points.length - 1]?.[0] ?? 0).toFixed(2)} ${height} L ${(points[0]?.[0] ?? 0).toFixed(2)} ${height} Z`;
	const sum = values.reduce((a, b) => a + b, 0);

	function onMove(e: React.MouseEvent<HTMLDivElement>) {
		if (!ref.current || values.length === 0) return;
		const rect = ref.current.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * width;
		let idx = Math.round((px / Math.max(1, width)) * (values.length - 1));
		idx = Math.max(0, Math.min(values.length - 1, idx));
		const pt = points[idx];
		if (!pt) return;
		const side: "left" | "right" = idx > values.length / 2 ? "left" : "right";
		setHover({ idx, x: pt[0], y: pt[1], side });
	}

	const cur = hover ? values[hover.idx] : null;
	const prev = hover && hover.idx > 0 ? values[hover.idx - 1] : null;
	const delta = cur != null && prev != null ? cur - prev : null;
	const deltaPct = delta != null && prev != null && prev !== 0 ? (delta / prev) * 100 : null;
	const sharePct = cur != null && sum > 0 ? (cur / sum) * 100 : 0;

	return (
		<div
			ref={ref}
			className="relative w-full cursor-crosshair"
			onMouseMove={onMove}
			onMouseLeave={() => setHover(null)}
		>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="none"
				className="block h-16 w-full"
				aria-hidden="true"
			>
				<path d={areaPath} fill={color} fillOpacity="0.14" />
				<path d={linePath} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
				{hover && (
					<g>
						<line x1={hover.x} x2={hover.x} y1={0} y2={height} stroke={color} strokeOpacity="0.35" strokeDasharray="2 2" />
						<circle cx={hover.x} cy={hover.y} r="3.5" fill="var(--color-surface-900)" stroke={color} strokeWidth="1.6" />
					</g>
				)}
			</svg>
			{hover && cur != null && (
				<div
					role="tooltip"
					className="pointer-events-none absolute z-30 min-w-[200px] rounded-lg border border-edge bg-surface-700 px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
					style={{
						left: `${(hover.x / width) * 100}%`,
						top: 0,
						transform: `translate(${hover.side === "left" ? "calc(-100% - 10px)" : "10px"}, 0)`,
					}}
				>
					<div className="mb-1.5 flex justify-between gap-3 border-b border-edge-dim pb-1.5">
						<span className="font-mono text-[12px] text-text-1">{formatMonthLabel(data[hover.idx].month)}</span>
						<span className="font-mono text-[10px] text-text-4">{sharePct.toFixed(1)}% of total</span>
					</div>
					<div className="flex items-center gap-2 py-0.5 font-mono text-[12px]">
						<span className="h-2 w-2 rounded-sm" style={{ background: color }} />
						<span className="flex-1 text-text-3">{valueLabel}</span>
						<span className="tabular-nums text-text-1">{fmtFull(cur)}</span>
					</div>
					{delta != null && (
						<div className="flex items-center gap-2 py-0.5 font-mono text-[11px] text-text-3">
							<span className="h-2 w-2" />
							<span className="flex-1">vs prev</span>
							<span
								className={cn(
									"tabular-nums",
									delta > 0 && "text-success",
									delta < 0 && "text-danger",
									delta === 0 && "text-text-3",
								)}
							>
								{delta >= 0 ? "+" : ""}
								{fmtFull(delta)}
								{deltaPct != null && ` · ${delta >= 0 ? "+" : ""}${deltaPct.toFixed(0)}%`}
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
