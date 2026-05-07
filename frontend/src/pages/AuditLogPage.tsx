import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AuditEvent } from "@/types/api";
import { useEffect, useState } from "react";

// Badge classes use semantic utilities from index.css
const ACTION_BADGES: Record<string, string> = {
	login:             "badge badge-info",
	logout:            "badge badge-neutral",
	token_created:     "badge badge-success",
	token_revoked:     "badge badge-danger",
	allowlist_added:   "badge badge-accent",
	allowlist_removed: "badge badge-caution",
};
const DEFAULT_BADGE = "badge badge-neutral";

export default function AuditLogPage() {
	const [items, setItems] = useState<AuditEvent[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		api.audit
			.list(page, 50)
			.then((res) => {
				setItems(res.items);
				setTotal(res.total);
			})
			.finally(() => setLoading(false));
	}, [page]);

	const totalPages = Math.ceil(total / 50);

	return (
		<div className="space-y-4">
			<h1 className="text-lg font-semibold text-text-1">Audit Log</h1>

			{loading ? (
				<p className="text-text-3 text-sm">Loading…</p>
			) : (
				<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-surface-800 border-b border-edge">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-text-3">Time</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Actor</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Action</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Target</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => (
								<tr key={item.id} className="border-b border-edge-dim hover:bg-surface-800 transition-colors">
									<td className="px-4 py-3 text-text-3 whitespace-nowrap">
										{formatDateTime(item.timestamp)}
									</td>
									<td className="px-4 py-3 text-text-2">{item.actorEmail ?? "—"}</td>
									<td className="px-4 py-3">
										<span className={ACTION_BADGES[item.action] ?? DEFAULT_BADGE}>
											{item.action}
										</span>
									</td>
									<td className="px-4 py-3 text-text-3">{item.target ?? "—"}</td>
								</tr>
							))}
							{items.length === 0 && (
								<tr>
									<td colSpan={4} className="px-4 py-6 text-center text-text-4">
										No audit events yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center gap-2 justify-end">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className="rounded border border-edge px-3 py-1 text-sm text-text-3 hover:bg-surface-800 hover:text-text-1 disabled:opacity-30 transition-colors"
					>
						Prev
					</button>
					<span className="text-sm text-text-3">
						{page} / {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="rounded border border-edge px-3 py-1 text-sm text-text-3 hover:bg-surface-800 hover:text-text-1 disabled:opacity-30 transition-colors"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}
