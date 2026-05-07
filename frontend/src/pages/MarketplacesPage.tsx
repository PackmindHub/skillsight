import { api } from "@/lib/api";
import type { Marketplace, MarketplaceStatus } from "@/types/api";
import { useEffect, useState } from "react";

const STATUS_OPTIONS: { value: MarketplaceStatus; label: string }[] = [
	{ value: "to_review", label: "To Review" },
	{ value: "approved", label: "Approved" },
	{ value: "denied", label: "Denied" },
];

const STATUS_BADGE: Record<MarketplaceStatus, string> = {
	to_review: "bg-amber-100 text-amber-700 border-amber-200",
	approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
	denied: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<MarketplaceStatus, string> = {
	to_review: "To Review",
	approved: "Approved",
	denied: "Denied",
};

interface EditState {
	url: string;
	description: string;
}

export default function MarketplacesPage() {
	const [items, setItems] = useState<Marketplace[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<Record<string, EditState>>({});
	const [saving, setSaving] = useState<Record<string, boolean>>({});

	useEffect(() => {
		api.marketplaces
			.list()
			.then((res) => setItems(res.marketplaces))
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	async function handleStatusChange(name: string, status: MarketplaceStatus) {
		setItems((prev) => prev.map((m) => (m.name === name ? { ...m, status } : m)));
		try {
			await api.marketplaces.update(name, { status });
		} catch {
			api.marketplaces.list().then((res) => setItems(res.marketplaces)).catch(() => {});
		}
	}

	function startEdit(mp: Marketplace) {
		setEditing((prev) => ({
			...prev,
			[mp.name]: { url: mp.url ?? "", description: mp.description ?? "" },
		}));
	}

	function cancelEdit(name: string) {
		setEditing((prev) => {
			const next = { ...prev };
			delete next[name];
			return next;
		});
	}

	async function saveEdit(name: string) {
		const state = editing[name];
		if (!state) return;
		setSaving((prev) => ({ ...prev, [name]: true }));
		try {
			const updated = await api.marketplaces.update(name, {
				url: state.url.trim() || null,
				description: state.description.trim() || null,
			});
			setItems((prev) => prev.map((m) => (m.name === name ? { ...m, ...updated } : m)));
			cancelEdit(name);
		} catch (e) {
			setError(String(e));
		} finally {
			setSaving((prev) => ({ ...prev, [name]: false }));
		}
	}

	if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-lg font-semibold text-gray-900">Marketplaces</h1>
				<p className="text-sm text-gray-500 mt-1">
					Marketplaces discovered from skill activation events. Review and approve or deny each source.
				</p>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			{items.length === 0 ? (
				<div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
					No marketplaces discovered yet. Marketplaces appear automatically when skills with{" "}
					<code className="font-mono text-xs">marketplace.name</code> are activated.
				</div>
			) : (
				<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Activations (30d)</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody>
							{items.map((mp) => {
								const isEditing = !!editing[mp.name];
								const isSaving = saving[mp.name] ?? false;
								const editState = editing[mp.name];
								return (
									<tr key={mp.name} className="border-b border-gray-100 hover:bg-gray-50">
										<td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">
											{mp.name}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<span
													className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[mp.status as MarketplaceStatus] ?? STATUS_BADGE.to_review}`}
												>
													{STATUS_LABEL[mp.status as MarketplaceStatus] ?? mp.status}
												</span>
												<select
													value={mp.status}
													onChange={(e) =>
														handleStatusChange(mp.name, e.target.value as MarketplaceStatus)
													}
													className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
												>
													{STATUS_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</select>
											</div>
										</td>
										<td className="px-4 py-3 text-gray-500 max-w-xs">
											{isEditing ? (
												<input
													type="url"
													value={editState.url}
													onChange={(e) =>
														setEditing((prev) => ({
															...prev,
															[mp.name]: { ...prev[mp.name], url: e.target.value },
														}))
													}
													placeholder="https://..."
													className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
												/>
											) : mp.url ? (
												<a
													href={mp.url}
													target="_blank"
													rel="noreferrer"
													className="text-indigo-600 hover:underline truncate block max-w-48"
												>
													{mp.url}
												</a>
											) : (
												<span className="text-gray-400">—</span>
											)}
										</td>
										<td className="px-4 py-3 text-gray-500 max-w-xs">
											{isEditing ? (
												<input
													type="text"
													value={editState.description}
													onChange={(e) =>
														setEditing((prev) => ({
															...prev,
															[mp.name]: {
																...prev[mp.name],
																description: e.target.value,
															},
														}))
													}
													placeholder="Free description…"
													className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
												/>
											) : mp.description ? (
												<span className="truncate block max-w-56">{mp.description}</span>
											) : (
												<span className="text-gray-400">—</span>
											)}
										</td>
										<td className="px-4 py-3 text-right text-gray-700">
											{mp.activationCount}
										</td>
										<td className="px-4 py-3 text-right whitespace-nowrap">
											{isEditing ? (
												<div className="flex items-center justify-end gap-2">
													<button
														type="button"
														onClick={() => saveEdit(mp.name)}
														disabled={isSaving}
														className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
													>
														{isSaving ? "Saving…" : "Save"}
													</button>
													<button
														type="button"
														onClick={() => cancelEdit(mp.name)}
														className="text-xs text-gray-500 hover:text-gray-700"
													>
														Cancel
													</button>
												</div>
											) : (
												<button
													type="button"
													onClick={() => startEdit(mp)}
													className="text-xs text-gray-500 hover:text-gray-700"
												>
													Edit
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
