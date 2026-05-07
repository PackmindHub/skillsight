import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { AllowedSkill } from "@/types/api";
import { type FormEvent, useEffect, useState } from "react";

export default function AllowlistPage() {
	const [skills, setSkills] = useState<AllowedSkill[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newSkill, setNewSkill] = useState("");
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		api.skills.allowed
			.list()
			.then(setSkills)
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	async function handleAdd(e: FormEvent) {
		e.preventDefault();
		const name = newSkill.trim();
		if (!name) return;
		if (skills.some((s) => s.skillName === name)) {
			setError("Skill already on allowlist.");
			return;
		}
		setAdding(true);
		setError(null);
		try {
			const added = await api.skills.allowed.add(name);
			setSkills((s) => [...s, added].sort((a, b) => a.skillName.localeCompare(b.skillName)));
			setNewSkill("");
		} catch (e) {
			setError(String(e));
		} finally {
			setAdding(false);
		}
	}

	async function handleRemove(skillName: string) {
		setSkills((s) => s.filter((x) => x.skillName !== skillName));
		try {
			await api.skills.allowed.remove(skillName);
		} catch {
			api.skills.allowed
				.list()
				.then(setSkills)
				.catch(() => {});
		}
	}

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-gray-900">Allowlist</h1>
			<p className="text-sm text-gray-500">
				Skills on this list are excluded from shadow detection.
			</p>

			<form onSubmit={handleAdd} className="flex gap-2">
				<input
					type="text"
					placeholder="skill-name"
					value={newSkill}
					onChange={(e) => setNewSkill(e.target.value)}
					className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
				/>
				<button
					type="submit"
					disabled={adding || !newSkill.trim()}
					className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{adding ? "Adding…" : "Add skill"}
				</button>
			</form>
			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
				{skills.length === 0 ? (
					<p className="px-4 py-6 text-center text-gray-400 text-sm">
						No skills on the allowlist yet.
					</p>
				) : (
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Skill name</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Added</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{skills.map((skill) => (
								<tr key={skill.skillName} className="border-b border-gray-100">
									<td className="px-4 py-3 font-mono text-gray-900">{skill.skillName}</td>
									<td className="px-4 py-3 text-gray-500">{skill.source ?? "—"}</td>
									<td className="px-4 py-3 text-gray-500">{formatDate(skill.addedAt)}</td>
									<td className="px-4 py-3 text-gray-500">{skill.addedBy ?? "—"}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => handleRemove(skill.skillName)}
											className="text-xs text-red-600 hover:text-red-800"
										>
											Remove
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
