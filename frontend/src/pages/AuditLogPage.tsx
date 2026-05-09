import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AuditEvent, AuditFilters } from "@/types/api";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AuditFiltersBar } from "@/components/audit/AuditFilters";
import { DiffView, isDiffMetadata } from "@/components/audit/DiffView";

const ACTION_BADGES: Record<string, string> = {
	login: "badge badge-info",
	logout: "badge badge-neutral",
	token_created: "badge badge-success",
	token_revoked: "badge badge-danger",
	allowlist_added: "badge badge-accent",
	allowlist_removed: "badge badge-caution",
	integration_created: "badge badge-success",
	integration_updated: "badge badge-caution",
	integration_deleted: "badge badge-danger",
	integration_data_cleared: "badge badge-danger",
	integration_paused: "badge badge-caution",
	integration_resumed: "badge badge-info",
	integration_sync_triggered: "badge badge-info",
	integration_sync_completed: "badge badge-info",
	integration_cursor_reset: "badge badge-caution",
	marketplace_status_changed: "badge badge-accent",
	marketplace_updated: "badge badge-caution",
	marketplace_source_created: "badge badge-success",
	marketplace_source_updated: "badge badge-caution",
	marketplace_source_deleted: "badge badge-danger",
	marketplace_source_sync_triggered: "badge badge-info",
	marketplace_source_sync_completed: "badge badge-info",
	plugin_status_changed: "badge badge-accent",
};
const DEFAULT_BADGE = "badge badge-neutral";
const PAGE_SIZE = 50;

export default function AuditLogPage() {
	const [items, setItems] = useState<AuditEvent[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(true);
	const [filters, setFilters] = useState<AuditFilters>({});
	const [availableActions, setAvailableActions] = useState<string[]>([]);
	const [expanded, setExpanded] = useState<number | null>(null);

	useEffect(() => {
		api.audit
			.actions()
			.then((res) => setAvailableActions(res.actions))
			.catch(() => setAvailableActions(Object.keys(ACTION_BADGES)));
	}, []);

	useEffect(() => {
		setLoading(true);
		api.audit
			.list(filters, page, PAGE_SIZE)
			.then((res) => {
				setItems(res.items);
				setTotal(res.total);
			})
			.finally(() => setLoading(false));
	}, [filters, page]);

	const totalPages = useMemo(() => Math.ceil(total / PAGE_SIZE), [total]);

	const onFiltersChange = (next: AuditFilters) => {
		setPage(1);
		setFilters(next);
	};

	const onExport = () => {
		window.location.href = api.audit.exportUrl(filters);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold text-text-1">Audit Log</h1>
				<span className="text-text-3 text-sm">{total} event{total === 1 ? "" : "s"}</span>
			</div>

			<AuditFiltersBar
				value={filters}
				availableActions={availableActions}
				onChange={onFiltersChange}
				onReset={() => onFiltersChange({})}
				onExport={onExport}
			/>

			{loading ? (
				<p className="text-text-3 text-sm">Loading…</p>
			) : (
				<div className="bg-surface-900 rounded-lg border border-edge overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-surface-800 border-b border-edge">
							<tr>
								<th className="text-left px-4 py-3 font-medium text-text-3 w-8" />
								<th className="text-left px-4 py-3 font-medium text-text-3">Time</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Actor</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Action</th>
								<th className="text-left px-4 py-3 font-medium text-text-3">Target</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => {
								const isOpen = expanded === item.id;
								const hasDetail = item.metadata !== null;
								return (
									<Fragment key={item.id}>
										<tr
											className="border-b border-edge-dim hover:bg-surface-800 transition-colors cursor-pointer"
											onClick={() => setExpanded(isOpen ? null : item.id)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													setExpanded(isOpen ? null : item.id);
												}
											}}
											tabIndex={hasDetail ? 0 : -1}
										>
											<td className="px-4 py-3 text-text-4">
												{hasDetail ? (isOpen ? "▾" : "▸") : ""}
											</td>
											<td className="px-4 py-3 text-text-3 whitespace-nowrap">
												{formatDateTime(item.timestamp)}
											</td>
											<td className="px-4 py-3 text-text-2">{item.actorEmail ?? "—"}</td>
											<td className="px-4 py-3">
												<span className={ACTION_BADGES[item.action] ?? DEFAULT_BADGE}>
													{item.action}
												</span>
											</td>
											<td className="px-4 py-3 text-text-3 font-mono text-xs">
												{item.target ?? "—"}
											</td>
										</tr>
										{isOpen && hasDetail && (
											<tr className="border-b border-edge-dim bg-surface-950">
												<td colSpan={5} className="px-4 py-3">
													<MetadataDetail metadata={item.metadata} />
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
							{items.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-6 text-center text-text-4">
										No audit events match the current filters.
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

function MetadataDetail({ metadata }: { metadata: Record<string, unknown> | null }) {
	if (!metadata) return null;
	if (isDiffMetadata(metadata)) return <DiffView diff={metadata} />;
	return (
		<pre className="text-xs text-text-3 bg-surface-900 border border-edge-dim rounded p-2 overflow-x-auto">
			{JSON.stringify(metadata, null, 2)}
		</pre>
	);
}
