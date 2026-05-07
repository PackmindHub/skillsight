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

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
	if (error) return <p className="text-red-600 text-sm">{error}</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-gray-900">Shadow Detection</h1>
			<p className="text-sm text-gray-500">Skills activated that are not on the allowlist.</p>

			{rows.length === 0 ? (
				<div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700 text-sm">
					All activated skills are on the allowlist.
				</div>
			) : (
				<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Skill</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Activations</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">First seen</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Last seen</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Users</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.skill_name} className="border-b border-gray-100 hover:bg-gray-50">
									<td className="px-4 py-3 font-mono text-gray-900">{row.skill_name}</td>
									<td className="px-4 py-3 text-right text-gray-700">{row.count}</td>
									<td className="px-4 py-3 text-gray-500">{formatDateTime(row.first_seen)}</td>
									<td className="px-4 py-3 text-gray-500">{formatDateTime(row.last_seen)}</td>
									<td className="px-4 py-3 text-right text-gray-700">{row.distinct_users}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => addToAllowlist(row.skill_name)}
											disabled={adding === row.skill_name}
											className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
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
