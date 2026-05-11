import { Sparkline } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
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

function computeDeltaPct(dailyCounts: number[]): number {
	if (dailyCounts.length < 4) return 0;
	const mid = Math.floor(dailyCounts.length / 2);
	const first = dailyCounts.slice(0, mid).reduce((a, b) => a + b, 0);
	const second = dailyCounts.slice(mid).reduce((a, b) => a + b, 0);
	if (first === 0) return second > 0 ? 100 : 0;
	return Math.round(((second - first) / first) * 100);
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

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
function formatMonth(iso: string): string {
	return monthFormatter.format(new Date(iso));
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
					<span className="ml-auto flex items-center gap-1.5">
						less
						<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.1)" }} />
						<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.35)" }} />
						<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.6)" }} />
						<span className="h-2.5 w-3.5 rounded-sm" style={{ background: "rgba(139, 92, 246, 0.9)" }} />
						more
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
	// Build a 12-week × 7-day grid from dailyTrend. Older weeks first.
	const needed = weeks * 7;
	const padded: HeatCell[] = dailyTrend.length >= needed
		? dailyTrend.slice(-needed).map((d) => ({ date: d.date, count: d.count }))
		: [
				...Array.from({ length: needed - dailyTrend.length }, () => ({ date: null, count: 0 }) as HeatCell),
				...dailyTrend.map((d) => ({ date: d.date, count: d.count })),
			];

	const grid: HeatCell[][] = [];
	for (let w = 0; w < weeks; w++) {
		const week: HeatCell[] = [];
		for (let d = 0; d < 7; d++) {
			week.push(padded[w * 7 + d] ?? { date: null, count: 0 });
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
	const [pendingMarketplaces, setPendingMarketplaces] = useState<number | null>(null);
	const [pendingPlugins, setPendingPlugins] = useState<number | null>(null);
	const [activeTokens, setActiveTokens] = useState<number | null>(null);
	const [monthly, setMonthly] = useState<MonthlyTrendsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		Promise.all([api.skills.usage(period), api.skills.table(period)])
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
			.then(({ marketplaces }) =>
				setPendingMarketplaces(
					(marketplaces as Marketplace[]).filter((m) => m.status === "to_review").length,
				),
			)
			.catch(() => {});
		api.plugins
			.list()
			.then(({ plugins }) =>
				setPendingPlugins((plugins as Plugin[]).filter((p) => p.status === "to_review").length),
			)
			.catch(() => {});
		api.tokens
			.list()
			.then((tokens) => setActiveTokens(tokens.filter((t) => !t.revokedAt).length))
			.catch(() => {});
		api.skills
			.monthlyTrends()
			.then((m) => setMonthly(m))
			.catch(() => {});
	}, []);

	const movers = useMemo(() => {
		return rows
			.filter((r) => r.total > 0)
			.map((r) => ({ ...r, deltaPct: computeDeltaPct(r.dailyCounts) }))
			.sort((a, b) => b.deltaPct - a.deltaPct)
			.slice(0, 6);
	}, [rows]);

	const heatmapData = useMemo(() => buildHeatmap(usage?.dailyTrend ?? [], 12), [usage]);

	const triggerTotals = useMemo(() => {
		const totals = { user: 0, claude: 0, nested: 0 };
		for (const r of rows) {
			totals.user += r.userSlash;
			totals.claude += r.claudeProactive;
			totals.nested += r.nestedSkill;
		}
		return totals;
	}, [rows]);

	const totalDaily = useMemo(() => (usage?.dailyTrend ?? []).map((d) => d.count), [usage]);

	const topTrigger = useMemo(() => usage?.byTrigger[0]?.trigger ?? "—", [usage]);

	const overallDelta = useMemo(() => computeDeltaPct(totalDaily), [totalDaily]);

	if (loading && !usage) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;
	if (!usage) return null;

	const triggerSum = Math.max(1, triggerTotals.user + triggerTotals.claude + triggerTotals.nested);
	const heroDelta = deltaPill(overallDelta);

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
						<span
							className={cn(
								"rounded-full px-2 py-[3px] font-mono text-[12px]",
								heroDelta.cls === "up" && "bg-success/15 text-success",
								heroDelta.cls === "down" && "bg-danger/15 text-danger",
								heroDelta.cls === "flat" && "bg-surface-700 text-text-3",
							)}
						>
							{heroDelta.label} vs prev
						</span>
					</div>
					<div className="mt-[18px] flex flex-wrap gap-[18px_28px]">
						<MiniStat
							label="Unique skills"
							value={
								<>
									{usage.stats.uniqueSkills}
									<span className="ml-1 text-[11px] text-text-4">/ {rows.length || "—"}</span>
								</>
							}
						/>
						<MiniStat label="Active users" value={usage.stats.activeUsers} />
						<MiniStat label="Top trigger" value={<span className="text-accent-2-soft">{topTrigger}</span>} />
						<MiniStat label="Marketplaces" value={pendingMarketplaces == null ? "—" : `${(pendingMarketplaces ?? 0) + 0}`} />
					</div>
					<div className="pointer-events-none absolute -bottom-2.5 -right-2.5 h-[110px] w-[55%] overflow-hidden">
						{totalDaily.length > 0 && (
							<div className="absolute right-0 bottom-0">
								<Sparkline
									values={totalDaily}
									width={520}
									height={110}
									strokeClass="stroke-accent-bright"
									fillClass="fill-accent-bright/10"
								/>
							</div>
						)}
					</div>
				</div>

				<Card className="flex flex-col">
					<CardHead title="Top movers" dotColor="var(--color-accent-2)" meta={`${period === "all" ? "all time" : `${PERIOD_DAYS[period]}d`} Δ`} />
					<div className="px-4 pb-3.5">
						{movers.length === 0 ? (
							<p className="py-6 text-center text-[12px] text-text-4">No movers yet.</p>
						) : (
							movers.map((m, i) => {
								const d = deltaPill(m.deltaPct);
								return (
									<div
										key={`${m.skillName}-${m.pluginName ?? "none"}`}
										className="grid items-center gap-3.5 border-t border-edge-dim py-2 first:border-t-0"
										style={{ gridTemplateColumns: "auto 1fr auto auto" }}
									>
										<span className="w-[18px] font-mono text-[11px] text-text-4">#{i + 1}</span>
										<div className="min-w-0">
											<div className="truncate font-mono text-[13px] text-text-1">{m.skillName}</div>
											<div className="truncate font-mono text-[10px] text-text-4">{m.pluginName ?? "—"}</div>
										</div>
										<span className="font-mono tabular-nums text-[13px] text-text-2">{fmtCompact(m.total)}</span>
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
					label="Ingestion tokens"
					value={activeTokens ?? "—"}
					trailing={<span className="text-[12px] text-text-3">active</span>}
					to="/tokens"
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
						</div>
						<div className="mt-3.5 grid grid-cols-3 gap-3.5">
							<TriggerStat label="user-slash" value={triggerTotals.user} pct={(triggerTotals.user / triggerSum) * 100} dotColor="var(--color-accent-bright)" />
							<TriggerStat label="claude-proactive" value={triggerTotals.claude} pct={(triggerTotals.claude / triggerSum) * 100} dotColor="var(--color-accent-2)" />
							<TriggerStat label="nested-skill" value={triggerTotals.nested} pct={(triggerTotals.nested / triggerSum) * 100} dotColor="var(--color-warning)" />
						</div>
					</div>
				</Card>
			</div>

			{/* Monthly sparklines */}
			<div className="grid gap-[18px] grid-cols-1 md:grid-cols-3">
				<MonthlyCard title="Invocations / month" data={monthly?.invocations ?? []} stroke="stroke-accent-bright" fill="fill-accent-bright/15" />
				<MonthlyCard title="Unique skills / month" data={monthly?.uniqueSkills ?? []} stroke="stroke-accent-2" fill="fill-accent-2/15" />
				<MonthlyCard title="Active users / month" data={monthly?.uniqueUsers ?? []} stroke="stroke-magenta" fill="fill-magenta/15" />
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
	stroke,
	fill,
}: {
	title: string;
	data: MonthlyPoint[];
	stroke: string;
	fill: string;
}) {
	const values = data.map((d) => d.count);
	return (
		<Card>
			<CardHead title={title} meta="since launch" />
			<div className="p-4 pt-1">
				{values.length === 0 ? (
					<p className="py-6 text-center text-[12px] text-text-4">No data yet.</p>
				) : (
					<>
						<Sparkline
					values={values}
					width={300}
					height={56}
					strokeClass={stroke}
					fillClass={fill}
					responsive
					className="block h-14 w-full"
				/>
						<div className="mt-1.5 flex justify-between font-mono text-[10px] text-text-4">
							{data.map((d) => (
								<span key={d.month}>{formatMonth(d.month)}</span>
							))}
						</div>
					</>
				)}
			</div>
		</Card>
	);
}
