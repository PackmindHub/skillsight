import { ConfirmMenuItem } from "@/components/ui/ConfirmMenuItem";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { Integration } from "@/types/api";

type Status = "active" | "paused" | "error";

function statusOf(integration: Integration): Status {
	if (integration.lastSyncError) return "error";
	if (!integration.enabled) return "paused";
	return "active";
}

function StatusPill({ status, error }: { status: Status; error: string | null }) {
	if (status === "error") {
		return (
			<span className="badge badge-danger" title={error ?? ""}>
				<span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-danger" />
				Error
			</span>
		);
	}
	if (status === "paused") {
		return (
			<span className="badge badge-neutral">
				<span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-neutral" />
				Paused
			</span>
		);
	}
	return (
		<span className="badge badge-success">
			<span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
			Active
		</span>
	);
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
	return (
		<div className="flex flex-col gap-0.5 min-w-0">
			<span className="text-[11px] uppercase tracking-wider text-text-4">{label}</span>
			<span className="text-sm text-text-1 truncate" title={title}>
				{value}
			</span>
		</div>
	);
}

interface IntegrationCardProps {
	integration: Integration;
	syncJustSucceeded: boolean;
	syncing: boolean;
	pausing: boolean;
	resuming: boolean;
	resetting: boolean;
	clearingData: boolean;
	deleting: boolean;
	onEdit: () => void;
	onSyncNow: () => void;
	onPause: () => void;
	onResume: () => void;
	onResetCursor: () => void;
	onClearData: () => void;
	onDelete: () => void;
}

export function IntegrationCard({
	integration,
	syncJustSucceeded,
	syncing,
	pausing,
	resuming,
	resetting,
	clearingData,
	deleting,
	onEdit,
	onSyncNow,
	onPause,
	onResume,
	onResetCursor,
	onClearData,
	onDelete,
}: IntegrationCardProps) {
	const status = statusOf(integration);
	const intervalSec = Math.round(integration.syncIntervalMs / 1000);
	const typeLabel = integration.type.charAt(0).toUpperCase() + integration.type.slice(1);

	const lastSyncDisplay = integration.lastSyncAt
		? formatRelativeTime(integration.lastSyncAt)
		: "Never";
	const lastSyncTitle = integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : undefined;

	return (
		<article className={`rounded-lg border border-edge bg-surface-900 transition-opacity ${status === "paused" ? "opacity-60" : ""}`}>
			<div className="flex items-start justify-between gap-3 px-5 pt-4">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-3">
						<h3 className="truncate text-base font-semibold text-text-1">{integration.name}</h3>
						<StatusPill status={status} error={integration.lastSyncError} />
						{syncJustSucceeded && (
							<span className="text-xs text-success">Synced just now</span>
						)}
					</div>
					<p className="mt-1 truncate text-xs text-text-3" title={integration.url}>
						<span className="text-text-4">{typeLabel} ·</span> {integration.url}
					</p>
				</div>

				<Menu
					trigger={({ open, toggle }) => (
						<button
							type="button"
							onClick={toggle}
							aria-label="Integration actions"
							aria-haspopup="menu"
							aria-expanded={open}
							className={`-mr-1 rounded p-1.5 text-text-3 transition-colors hover:bg-surface-800 hover:text-text-1 ${open ? "bg-surface-800 text-text-1" : ""}`}
						>
							<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<circle cx="10" cy="4" r="1.5" />
								<circle cx="10" cy="10" r="1.5" />
								<circle cx="10" cy="16" r="1.5" />
							</svg>
						</button>
					)}
				>
					<MenuItem onClick={onEdit}>Edit</MenuItem>
					<MenuDivider />
					<ConfirmMenuItem
						label="Reset cursor"
						confirmLabel="Reset"
						loading={resetting}
						variant="warning"
						onConfirm={onResetCursor}
					/>
					<ConfirmMenuItem
						label="Clear data"
						confirmLabel="Clear"
						loading={clearingData}
						variant="warning"
						onConfirm={onClearData}
					/>
					<MenuDivider />
					<ConfirmMenuItem
						label="Delete integration"
						confirmLabel="Delete"
						loading={deleting}
						variant="danger"
						onConfirm={onDelete}
					/>
				</Menu>
			</div>

			<div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
				<Metric label="Auth" value={integration.authType === "basic" ? "Basic" : "None"} />
				<Metric label="Interval" value={`${intervalSec}s`} />
				<Metric label="Last sync" value={lastSyncDisplay} title={lastSyncTitle} />
				<Metric label="Ingested" value={integration.eventCount.toLocaleString()} />
			</div>

			<div className="mx-5 mb-3 rounded border border-edge-dim bg-surface-950/60 px-3 py-2">
				<p
					className="truncate font-mono text-xs text-text-3"
					title={integration.lokiQuery}
				>
					{integration.lokiQuery}
				</p>
			</div>

			<div className="flex items-center gap-2 border-t border-edge-dim px-5 py-3">
				<button
					type="button"
					disabled={syncing || !integration.enabled}
					onClick={onSyncNow}
					className="btn-primary rounded-md px-3 py-1.5 text-xs font-medium"
				>
					{syncing ? "Syncing…" : "Sync now"}
				</button>
				{integration.enabled ? (
					<button
						type="button"
						disabled={pausing}
						onClick={onPause}
						className="rounded-md border border-edge px-3 py-1.5 text-xs text-warning transition-colors hover:bg-surface-800 disabled:opacity-40"
					>
						{pausing ? "Pausing…" : "Pause sync"}
					</button>
				) : (
					<button
						type="button"
						disabled={resuming}
						onClick={onResume}
						className="rounded-md border border-edge px-3 py-1.5 text-xs text-success transition-colors hover:bg-surface-800 disabled:opacity-40"
					>
						{resuming ? "Resuming…" : "Resume sync"}
					</button>
				)}
			</div>
		</article>
	);
}
