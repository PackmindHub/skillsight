import { api } from "@/lib/api";
import type { MarketplaceRef, SkillTableRow } from "@/types/api";
import { useEffect, useState } from "react";

// Marketplace status colors reference status tokens in index.css
const MP_STATUS_STYLES: Record<string, string> = {
	approved: "bg-success/15 text-success border-success/30",
	denied:   "bg-danger/15  text-danger  border-danger/30",
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

// Trigger colors reference --color-accent-bright, --color-success, --color-warning in index.css
const TRIGGERS: { key: keyof SkillTableRow; label: string; color: string }[] = [
	{ key: "user_slash", label: "user-slash", color: "bg-accent-bright" },
	{ key: "claude_proactive", label: "claude-proactive", color: "bg-success" },
	{ key: "nested_skill", label: "nested-skill", color: "bg-warning" },
];

function ProgressCell({ count, total, color }: { count: number; total: number; color: string }) {
	const pct = total > 0 ? (count / total) * 100 : 0;
	return (
		<td className="px-4 py-3 group/cell relative">
			<div className="h-3 w-full bg-surface-700 rounded-full overflow-hidden">
				<div
					className={`h-full rounded-full ${color}`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block whitespace-nowrap rounded bg-surface-800 border border-edge px-2 py-1 text-xs text-text-1 z-10">
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

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-text-1">Skills</h1>
			<p className="text-sm text-text-3">All skills activated in the last 30 days, with trigger breakdown.</p>

			{rows.length === 0 ? (
				<div className="bg-surface-900 border border-edge rounded-lg p-6 text-center text-text-3 text-sm">
					No skill activations recorded.
				</div>
			) : (
				<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-surface-800 border-b border-edge">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-text-3">Skill</th>
								<th className="text-right px-4 py-3 font-medium text-text-3">Total</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Marketplaces</th>
								{TRIGGERS.map(({ key, label, color }) => (
									<th key={key} className="px-4 py-3 font-medium text-text-3 min-w-32">
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
								<tr key={row.skill_name} className="border-b border-edge-dim hover:bg-surface-800 transition-colors">
									<td className="px-4 py-3 font-mono text-text-1">{row.skill_name}</td>
									<td className="px-4 py-3 text-right text-text-2">{row.total}</td>
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
