import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AuditEvent } from "@/types/api";
import { useEffect, useState } from "react";

const ACTION_COLORS: Record<string, string> = {
	login: "bg-blue-100 text-blue-700",
	logout: "bg-gray-100 text-gray-600",
	token_created: "bg-green-100 text-green-700",
	token_revoked: "bg-red-100 text-red-700",
	allowlist_added: "bg-indigo-100 text-indigo-700",
	allowlist_removed: "bg-orange-100 text-orange-700",
};

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
			<h1 className="text-lg font-semibold text-gray-900">Audit Log</h1>

			{loading ? (
				<p className="text-gray-500 text-sm">Loading…</p>
			) : (
				<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 border-b border-gray-200">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => (
								<tr key={item.id} className="border-b border-gray-100">
									<td className="px-4 py-3 text-gray-500 whitespace-nowrap">
										{formatDateTime(item.timestamp)}
									</td>
									<td className="px-4 py-3 text-gray-700">{item.actorEmail ?? "—"}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[item.action] ?? "bg-gray-100 text-gray-600"}`}
										>
											{item.action}
										</span>
									</td>
									<td className="px-4 py-3 text-gray-500">{item.target ?? "—"}</td>
								</tr>
							))}
							{items.length === 0 && (
								<tr>
									<td colSpan={4} className="px-4 py-6 text-center text-gray-400">
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
						className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
					>
						Prev
					</button>
					<span className="text-sm text-gray-500">
						{page} / {totalPages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}
