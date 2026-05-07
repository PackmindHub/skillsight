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

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-text-1">Allowlist</h1>
			<p className="text-sm text-text-3">
				Skills on this list are excluded from shadow detection.
			</p>

			<form onSubmit={handleAdd} className="flex gap-2">
				<input
					type="text"
					placeholder="skill-name"
					value={newSkill}
					onChange={(e) => setNewSkill(e.target.value)}
					className="flex-1 rounded-md border border-edge bg-surface-800 px-3 py-2 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-2 focus:ring-accent-bright focus:border-accent-bright"
				/>
				<button
					type="submit"
					disabled={adding || !newSkill.trim()}
					className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
				>
					{adding ? "Adding…" : "Add skill"}
				</button>
			</form>
			{error && <p className="text-sm text-danger">{error}</p>}

			<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
				{skills.length === 0 ? (
					<p className="px-4 py-6 text-center text-text-4 text-sm">
						No skills on the allowlist yet.
					</p>
				) : (
					<table className="w-full text-sm">
						<thead className="bg-surface-800 border-b border-edge">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-text-3">Skill name</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Source</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Added</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">By</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{skills.map((skill) => (
								<tr key={skill.skillName} className="border-b border-edge-dim hover:bg-surface-800 transition-colors">
									<td className="px-4 py-3 font-mono text-text-1">{skill.skillName}</td>
									<td className="px-4 py-3 text-text-3">{skill.source ?? "—"}</td>
									<td className="px-4 py-3 text-text-3">{formatDate(skill.addedAt)}</td>
									<td className="px-4 py-3 text-text-3">{skill.addedBy ?? "—"}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => handleRemove(skill.skillName)}
											className="text-xs text-danger hover:opacity-80 transition-opacity"
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
