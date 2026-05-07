import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ShadowSkill } from "@/types/api";
import { useEffect, useState } from "react";

export default function ShadowDetectionPage() {
	const [rows, setRows] = useState<ShadowSkill[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [adding, setAdding] = useState<string | null>(null);

	useEffect(() => {
		api.skills
			.shadow()
			.then(setRows)
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	async function addToAllowlist(skillName: string) {
		setAdding(skillName);
		try {
			await api.skills.allowed.add(skillName);
			setRows((r) => r.filter((s) => s.skill_name !== skillName));
		} catch (e) {
			alert(`Failed: ${e}`);
		} finally {
			setAdding(null);
		}
	}

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;
	if (error) return <p className="text-danger text-sm">{error}</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-text-1">Shadow Detection</h1>
			<p className="text-sm text-text-3">Skills activated that are not on the allowlist.</p>

			{rows.length === 0 ? (
				<div className="bg-success/10 border border-success/25 rounded-lg p-6 text-center text-success text-sm">
					All activated skills are on the allowlist.
				</div>
			) : (
				<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-surface-800 border-b border-edge">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-text-3">Skill</th>
								<th className="text-right px-4 py-3 font-medium text-text-3">Activations</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">First seen</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Last seen</th>
								<th className="text-right px-4 py-3 font-medium text-text-3">Users</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.skill_name} className="border-b border-edge-dim hover:bg-surface-800 transition-colors">
									<td className="px-4 py-3 font-mono text-text-1">{row.skill_name}</td>
									<td className="px-4 py-3 text-right text-text-2">{row.count}</td>
									<td className="px-4 py-3 text-text-3">{formatDateTime(row.first_seen)}</td>
									<td className="px-4 py-3 text-text-3">{formatDateTime(row.last_seen)}</td>
									<td className="px-4 py-3 text-right text-text-2">{row.distinct_users}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => addToAllowlist(row.skill_name)}
											disabled={adding === row.skill_name}
											className="btn-primary text-xs px-3 py-1 rounded"
										>
											{adding === row.skill_name ? "Adding…" : "Add to allowlist"}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
