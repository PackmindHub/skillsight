import { api } from "@/lib/api";
import type { Plugin, PluginStatus } from "@/types/api";
import { useEffect, useState } from "react";

const STATUS_BADGE: Record<PluginStatus, string> = {
	unknown: "bg-gray-100 text-gray-600 border-gray-200",
	to_review: "bg-amber-100 text-amber-700 border-amber-200",
	approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
	removed: "bg-red-100 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<PluginStatus, string> = {
	unknown: "Unknown",
	to_review: "To Review",
	approved: "Approved",
	removed: "Removed",
};

export default function PluginsPage() {
	const [items, setItems] = useState<Plugin[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api.plugins
			.list()
			.then((res) => setItems(res.plugins))
			.catch((e) => setError(String(e)))
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <p className="text-text-3 text-sm">Loading…</p>;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-lg font-semibold text-text-1">Plugins</h1>
				<p className="text-sm text-text-3 mt-1">
					Plugins discovered from installation events. Status reflects the approval state of the
					associated marketplace.
				</p>
			</div>

			{error && <p className="text-sm text-red-400">{error}</p>}

			{items.length === 0 ? (
				<div className="bg-surface-900 border border-edge rounded-lg p-12 flex flex-col items-center gap-3 text-center">
					<div className="w-12 h-12 rounded-full bg-surface-800 border border-edge flex items-center justify-center">
						<svg className="w-6 h-6 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} role="img" aria-label="No plugins">
							<path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.036 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
						</svg>
					</div>
					<div>
						<p className="text-sm font-medium text-text-2">No plugins discovered yet</p>
						<p className="text-xs text-text-4 mt-1">
							Plugins appear automatically when{" "}
							<code className="font-mono bg-surface-800 px-1 py-0.5 rounded text-text-3">plugin_installed</code>{" "}
							events are received.
						</p>
					</div>
				</div>
			) : (
				<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Plugin</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Marketplace</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Version</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Trigger</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Installations</th>
								<th className="text-right px-4 py-3 font-medium text-gray-600">Unique Users</th>
							</tr>
						</thead>
						<tbody>
							{items.map((plugin) => {
								const status = (plugin.status ?? "unknown") as PluginStatus;
								return (
									<tr
										key={plugin.pluginName}
										className="border-b border-gray-100 hover:bg-gray-50"
									>
										<td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">
											{plugin.pluginName}
										</td>
										<td className="px-4 py-3 text-gray-500">
											{plugin.marketplaceName ?? (
												<span className="text-gray-400">—</span>
											)}
										</td>
										<td className="px-4 py-3 text-gray-500">
											{plugin.pluginVersion ?? (
												<span className="text-gray-400">—</span>
											)}
										</td>
										<td className="px-4 py-3">
											{plugin.installTrigger ? (
												<span className="inline-block rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
													{plugin.installTrigger}
												</span>
											) : (
												<span className="text-gray-400">—</span>
											)}
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
											>
												{STATUS_LABEL[status]}
											</span>
										</td>
										<td className="px-4 py-3 text-right text-gray-700">
											{plugin.installationCount}
										</td>
										<td className="px-4 py-3 text-right text-gray-700">
											{plugin.uniqueUserCount}
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
