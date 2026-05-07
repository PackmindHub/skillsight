import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { UsageResponse } from "@/types/api";
import { useEffect, useState } from "react";
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

// Chart colors — mirror the accent/status tokens defined in index.css
const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#f472b6", "#fbbf24", "#34d399"];
const GRID_COLOR    = "#212b42"; // --color-edge-dim
const AXIS_COLOR    = "#2a3454"; // --color-edge
const TICK_COLOR    = "#7e97b2"; // --color-text-3
const TOOLTIP_STYLE = {
	backgroundColor: "#1d2845", // --color-surface-700
	border: "1px solid #2a3454", // --color-edge
	borderRadius: "6px",
	color: "#e2e8f0",            // --color-text-1
	fontSize: "12px",
};

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="bg-surface-900 rounded-lg border border-edge p-4 relative overflow-hidden">
			<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-bright via-accent-2 to-transparent" />
			<p className="text-xs text-text-3 uppercase tracking-wide">{label}</p>
			<p className="mt-1 text-2xl font-semibold text-text-1">{value}</p>
		</div>
	);
}

export default function DashboardPage() {
	const [data, setData] = useState<UsageResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api.skills
			.usage(30)
			.then((d) => setData(d))
			.catch((e: unknown) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;
	if (!data) return null;

	const topTrigger = data.byTrigger[0]?.trigger ?? "—";

	return (
		<div className="space-y-6">
			<h1 className="text-lg font-semibold text-text-1">Dashboard — last 30 days</h1>

			<div className="grid grid-cols-4 gap-4">
				<StatCard label="Total activations" value={data.stats.totalActivations} />
				<StatCard label="Unique skills" value={data.stats.uniqueSkills} />
				<StatCard label="Active users" value={data.stats.activeUsers} />
				<StatCard label="Top trigger" value={topTrigger} />
			</div>

			<div className="grid grid-cols-2 gap-6">
				<div className="bg-surface-900 rounded-lg border border-edge p-4">
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
								dataKey="skill_name"
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
				</div>

				<div className="bg-surface-900 rounded-lg border border-edge p-4">
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
				</div>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<div className="bg-surface-900 rounded-lg border border-edge p-4">
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
				</div>

				<div className="bg-surface-900 rounded-lg border border-edge p-4">
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
										<Cell key={entry.trigger ?? `unknown-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
									))}
								</Pie>
								<Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#94a3b8" }} />
								<Legend formatter={(v) => (
									<span style={{ color: "#94a3b8", fontSize: 12 }}>{v ?? "unknown"}</span>
								)} />
							</PieChart>
						</ResponsiveContainer>
					) : (
						<p className="text-sm text-text-4 text-center py-8">No data yet</p>
					)}
				</div>
			</div>
		</div>
	);
}
