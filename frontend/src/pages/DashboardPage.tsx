import { Card, PageHeader, SegmentedControl } from "@/components/ui";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type {
	DashboardPeriod,
	Marketplace,
	MonthlyTrendsResponse,
	Plugin,
	UsageResponse,
} from "@/types/api";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#f472b6", "#fbbf24", "#34d399"];
const GRID_COLOR = "#212b42";
const AXIS_COLOR = "#2a3454";
const TICK_COLOR = "#7e97b2";
const TOOLTIP_STYLE = {
	backgroundColor: "#1d2845",
	border: "1px solid #2a3454",
	borderRadius: "6px",
	color: "#e2e8f0",
	fontSize: "12px",
};

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
	{ value: 30, label: "30 jours" },
	{ value: 90, label: "90 jours" },
	{ value: "all", label: "Depuis le début" },
];

const PERIOD_HEADING: Record<DashboardPeriod, string> = {
	7: "Dashboard — 7 derniers jours",
	30: "Dashboard — 30 derniers jours",
	90: "Dashboard — 90 derniers jours",
	all: "Dashboard — depuis le début",
};

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });
function formatMonth(iso: string): string {
	return monthFormatter.format(new Date(iso));
}

function StatCard({
	label,
	value,
	to,
	highlight,
}: {
	label: string;
	value: number | string;
	to?: string;
	highlight?: boolean;
}) {
	const className = cn(
		"bg-surface-900 rounded-lg border border-edge p-4 relative overflow-hidden block",
		to && "transition-colors hover:border-accent-2 hover:bg-surface-800 cursor-pointer",
		highlight && "border-warning/40",
	);
	const content = (
		<>
			<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-bright via-accent-2 to-transparent" />
			<p className="text-xs text-text-3 uppercase tracking-wide">{label}</p>
			<p className="mt-1 text-2xl font-semibold text-text-1">{value}</p>
			{to && <p className="mt-1 text-[10px] text-text-4 uppercase tracking-wide">Voir →</p>}
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

function MonthlyLineChart({
	data,
	color,
}: {
	data: { month: string; count: number }[];
	color: string;
}) {
	if (data.length === 0) {
		return <p className="text-sm text-text-4 text-center py-12">No data yet</p>;
	}
	return (
		<ResponsiveContainer width="100%" height={220}>
			<LineChart data={data}>
				<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
				<XAxis
					dataKey="month"
					tickFormatter={formatMonth}
					stroke={AXIS_COLOR}
					tick={{ fill: TICK_COLOR, fontSize: 10 }}
					tickLine={false}
				/>
				<YAxis
					stroke={AXIS_COLOR}
					tick={{ fill: TICK_COLOR, fontSize: 11 }}
					tickLine={false}
					allowDecimals={false}
				/>
				<Tooltip
					labelFormatter={(d) => formatMonth(String(d))}
					contentStyle={TOOLTIP_STYLE}
					labelStyle={{ color: "#94a3b8" }}
					cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
				/>
				<Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} />
			</LineChart>
		</ResponsiveContainer>
	);
}

export default function DashboardPage() {
	const [period, setPeriod] = useState<DashboardPeriod>(30);
	const [data, setData] = useState<UsageResponse | null>(null);
	const [pendingMarketplaces, setPendingMarketplaces] = useState<number | null>(null);
	const [pendingPlugins, setPendingPlugins] = useState<number | null>(null);
	const [monthly, setMonthly] = useState<MonthlyTrendsResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		api.skills
			.usage(period)
			.then((d) => setData(d))
			.catch((e: unknown) => setError(String(e)))
			.finally(() => setLoading(false));
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
		api.skills
			.monthlyTrends()
			.then((m) => setMonthly(m))
			.catch(() => {});
	}, []);

	const topTrigger = useMemo(() => data?.byTrigger[0]?.trigger ?? "—", [data]);

	if (loading && !data) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;
	if (!data) return null;

	return (
		<div className="space-y-6">
			<PageHeader
				title={PERIOD_HEADING[period]}
				actions={
					<SegmentedControl<DashboardPeriod>
						value={period}
						onChange={setPeriod}
						options={PERIOD_OPTIONS}
						ariaLabel="Period"
					/>
				}
			/>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
				<StatCard label="Total activations" value={data.stats.totalActivations} />
				<StatCard label="Unique skills" value={data.stats.uniqueSkills} />
				<StatCard label="Active users" value={data.stats.activeUsers} />
				<StatCard label="Top trigger" value={topTrigger} />
				<StatCard
					label="Marketplaces à approuver"
					value={pendingMarketplaces ?? "—"}
					to="/marketplaces?status=to_review"
					highlight={(pendingMarketplaces ?? 0) > 0}
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<StatCard
					label="Plugins à approuver"
					value={pendingPlugins ?? "—"}
					to="/plugins?status=to_review"
					highlight={(pendingPlugins ?? 0) > 0}
				/>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<Card>
					<h2 className="text-sm font-medium text-text-3 mb-3">Top 10 Skills</h2>
					<ResponsiveContainer width="100%" height={240}>
						<BarChart data={data.topSkills} layout="vertical">
							<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
							<XAxis
								type="number"
								stroke={AXIS_COLOR}
								tick={{ fill: TICK_COLOR, fontSize: 11 }}
								tickLine={false}
							/>
							<YAxis
								type="category"
								dataKey="skillName"
								width={120}
								stroke={AXIS_COLOR}
								tick={{ fill: TICK_COLOR, fontSize: 11 }}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={TOOLTIP_STYLE}
								labelStyle={{ color: "#94a3b8" }}
								cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
							/>
							<Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 2, 2, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</Card>

				<Card>
					<h2 className="text-sm font-medium text-text-3 mb-3">Daily Activations</h2>
					<ResponsiveContainer width="100%" height={240}>
						<LineChart data={data.dailyTrend}>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
							<XAxis
								dataKey="date"
								tickFormatter={(d) => formatDate(d)}
								stroke={AXIS_COLOR}
								tick={{ fill: TICK_COLOR, fontSize: 10 }}
								tickLine={false}
							/>
							<YAxis
								stroke={AXIS_COLOR}
								tick={{ fill: TICK_COLOR, fontSize: 11 }}
								tickLine={false}
							/>
							<Tooltip
								labelFormatter={(d) => formatDate(String(d))}
								contentStyle={TOOLTIP_STYLE}
								labelStyle={{ color: "#94a3b8" }}
								cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
							/>
							<Line
								type="monotone"
								dataKey="count"
								stroke={CHART_COLORS[0]}
								strokeWidth={2}
								dot={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</Card>
			</div>

			<div className="space-y-3">
				<h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">
					Évolution mensuelle (depuis le début)
				</h2>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<Card>
						<h3 className="text-sm font-medium text-text-3 mb-3">Skills uniques activés / mois</h3>
						<MonthlyLineChart data={monthly?.uniqueSkills ?? []} color={CHART_COLORS[1]} />
					</Card>
					<Card>
						<h3 className="text-sm font-medium text-text-3 mb-3">Total invocations / mois</h3>
						<MonthlyLineChart data={monthly?.invocations ?? []} color={CHART_COLORS[0]} />
					</Card>
					<Card>
						<h3 className="text-sm font-medium text-text-3 mb-3">Utilisateurs uniques / mois</h3>
						<MonthlyLineChart data={monthly?.uniqueUsers ?? []} color={CHART_COLORS[2]} />
					</Card>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<Card>
					<h2 className="text-sm font-medium text-text-3 mb-3">Top Users</h2>
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-edge-dim">
								<th className="text-left py-1 text-text-3 font-normal">User</th>
								<th className="text-right py-1 text-text-3 font-normal">Activations</th>
							</tr>
						</thead>
						<tbody>
							{data.topUsers.map((u: { user_email: string; count: number }) => (
								<tr key={u.user_email} className="border-b border-edge-dim">
									<td className="py-1 text-text-2 truncate max-w-[180px]">{u.user_email}</td>
									<td className="py-1 text-right text-text-1 font-medium">{u.count}</td>
								</tr>
							))}
							{data.topUsers.length === 0 && (
								<tr>
									<td colSpan={2} className="py-4 text-center text-text-4">
										No data yet
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</Card>

				<Card>
					<h2 className="text-sm font-medium text-text-3 mb-3">By Trigger</h2>
					{data.byTrigger.length > 0 ? (
						<ResponsiveContainer width="100%" height={200}>
							<PieChart>
								<Pie
									data={data.byTrigger}
									dataKey="count"
									nameKey="trigger"
									cx="50%"
									cy="50%"
									outerRadius={70}
								>
									{data.byTrigger.map((entry: { trigger: string | null }, i: number) => (
										<Cell
											key={entry.trigger ?? `unknown-${i}`}
											fill={CHART_COLORS[i % CHART_COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#94a3b8" }} />
								<Legend
									formatter={(v) => (
										<span style={{ color: "#94a3b8", fontSize: 12 }}>{v ?? "unknown"}</span>
									)}
								/>
							</PieChart>
						</ResponsiveContainer>
					) : (
						<p className="text-sm text-text-4 text-center py-8">No data yet</p>
					)}
				</Card>
			</div>
		</div>
	);
}
