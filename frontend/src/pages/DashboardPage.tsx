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

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-4">
			<p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
			<p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
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

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
	if (error) return <p className="text-red-600 text-sm">{error}</p>;
	if (!data) return null;

	const topTrigger = data.byTrigger[0]?.trigger ?? "—";

	return (
		<div className="space-y-6">
			<h1 className="text-lg font-semibold text-gray-900">Dashboard — last 30 days</h1>

			<div className="grid grid-cols-4 gap-4">
				<StatCard label="Total activations" value={data.stats.totalActivations} />
				<StatCard label="Unique skills" value={data.stats.uniqueSkills} />
				<StatCard label="Active users" value={data.stats.activeUsers} />
				<StatCard label="Top trigger" value={topTrigger} />
			</div>

			<div className="grid grid-cols-2 gap-6">
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-700 mb-3">Top 10 Skills</h2>
					<ResponsiveContainer width="100%" height={240}>
						<BarChart data={data.topSkills} layout="vertical">
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis type="number" />
							<YAxis type="category" dataKey="skill_name" width={120} tick={{ fontSize: 11 }} />
							<Tooltip />
							<Bar dataKey="count" fill="#6366f1" />
						</BarChart>
					</ResponsiveContainer>
				</div>

				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-700 mb-3">Daily Activations</h2>
					<ResponsiveContainer width="100%" height={240}>
						<LineChart data={data.dailyTrend}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} tick={{ fontSize: 10 }} />
							<YAxis />
							<Tooltip labelFormatter={(d) => formatDate(String(d))} />
							<Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} />
						</LineChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-6">
				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-700 mb-3">Top Users</h2>
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-gray-100">
								<th className="text-left py-1 text-gray-500 font-normal">User</th>
								<th className="text-right py-1 text-gray-500 font-normal">Activations</th>
							</tr>
						</thead>
						<tbody>
							{data.topUsers.map((u: { user_email: string; count: number }) => (
								<tr key={u.user_email} className="border-b border-gray-50">
									<td className="py-1 text-gray-700 truncate max-w-[180px]">{u.user_email}</td>
									<td className="py-1 text-right text-gray-900 font-medium">{u.count}</td>
								</tr>
							))}
							{data.topUsers.length === 0 && (
								<tr>
									<td colSpan={2} className="py-4 text-center text-gray-400">
										No data yet
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<div className="bg-white rounded-lg border border-gray-200 p-4">
					<h2 className="text-sm font-medium text-gray-700 mb-3">By Trigger</h2>
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
										<Cell key={entry.trigger ?? `unknown-${i}`} fill={COLORS[i % COLORS.length]} />
									))}
								</Pie>
								<Tooltip />
								<Legend formatter={(v) => v ?? "unknown"} />
							</PieChart>
						</ResponsiveContainer>
					) : (
						<p className="text-sm text-gray-400 text-center py-8">No data yet</p>
					)}
				</div>
			</div>
		</div>
	);
}
