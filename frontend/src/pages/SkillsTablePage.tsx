import { api } from "@/lib/api";
import type { SkillTableRow } from "@/types/api";
import { useEffect, useState } from "react";

const TRIGGERS: { key: keyof SkillTableRow; label: string; color: string }[] = [
	{ key: "user_slash", label: "user-slash", color: "bg-indigo-500" },
	{ key: "claude_proactive", label: "claude-proactive", color: "bg-emerald-500" },
	{ key: "nested_skill", label: "nested-skill", color: "bg-amber-500" },
];

function ProgressCell({ count, total, color }: { count: number; total: number; color: string }) {
	const pct = total > 0 ? (count / total) * 100 : 0;
	return (
		<td className="px-4 py-3 group/cell relative">
			<div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
				<div
					className={`h-full rounded-full ${color}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white z-10">
				{count} ({pct.toFixed(1)}%)
			</span>
		</td>
	);
}

export default function SkillsTablePage() {
	const [rows, setRows] = useState<SkillTableRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api.skills
			.table()
			.then((res) => setRows(res.rows))
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
	if (error) return <p className="text-red-600 text-sm">{error}</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-gray-900">Skills</h1>
			<p className="text-sm text-gray-500">All skills activated in the last 30 days, with trigger breakdown.</p>

			{rows.length === 0 ? (
				<div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
					No skill activations recorded.
				</div>
			) : (
				<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Skill</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
								{TRIGGERS.map(({ key, label, color }) => (
									<th key={key} className="px-4 py-3 font-medium text-gray-600 min-w-32">
										<div className="flex items-center gap-1.5">
											<span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
											{label}
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.skill_name} className="border-b border-gray-100 hover:bg-gray-50">
									<td className="px-4 py-3 font-mono text-gray-900">{row.skill_name}</td>
									<td className="px-4 py-3 text-right text-gray-700">{row.total}</td>
									{TRIGGERS.map(({ key, color }) => (
										<ProgressCell
											key={key}
											count={row[key] as number}
											total={row.total}
											color={color}
										/>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
