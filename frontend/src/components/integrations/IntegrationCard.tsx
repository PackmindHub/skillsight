import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmMenuItem } from "@/components/ui/ConfirmMenuItem";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { Integration } from "@/types/api";

type Status = "active" | "paused" | "error";

function statusOf(integration: Integration): Status {
	if (integration.lastSyncError) return "error";
	if (!integration.enabled) return "paused";
	return "active";
}

const STATUS_META: Record<
	Status,
	{ label: string; color: string; pillBg: string; pillBorder: string }
> = {
	active: {
		label: "Active",
		color: "var(--color-success)",
		pillBg: "color-mix(in srgb, var(--color-success) 12%, transparent)",
		pillBorder: "color-mix(in srgb, var(--color-success) 35%, transparent)",
	},
	paused: {
		label: "Paused",
		color: "var(--color-warning)",
		pillBg: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
		pillBorder: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
	},
	error: {
		label: "Error",
		color: "var(--color-danger)",
		pillBg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
		pillBorder: "color-mix(in srgb, var(--color-danger) 35%, transparent)",
	},
};

function LokiIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path
				d="M10 2l7 4v8l-7 4-7-4V6l7-4z"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d="M3 6l7 4 7-4M10 10v8" stroke="currentColor" strokeWidth="1.4" />
		</svg>
	);
}

function StatusPill({ status }: { status: Status }) {
	const meta = STATUS_META[status];
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]"
			style={{ color: meta.color, background: meta.pillBg, borderColor: meta.pillBorder }}
		>
			<span
				className={cn("h-1.5 w-1.5 rounded-full", status === "active" && "animate-pulse")}
				style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
			/>
			{meta.label}
		</span>
	);
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
				{label}
			</span>
			<span className="truncate text-sm text-text-1" title={title}>
				{value}
			</span>
		</div>
	);
}

function ResumeButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={loading}
			className="inline-flex items-center gap-2 rounded-md border border-success/60 bg-gradient-to-b from-success/85 to-success px-4 py-2 text-sm font-semibold text-surface-950 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-success)_30%,transparent),0_6px_16px_-4px_color-mix(in_srgb,var(--color-success)_45%,transparent)] transition-transform hover:-translate-y-px hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-success)_45%,transparent),0_10px_22px_-4px_color-mix(in_srgb,var(--color-success)_55%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{loading ? (
				<svg
					className="animate-spin"
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
				>
					<circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
					<path
						d="M14 8a6 6 0 0 0-6-6"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			) : (
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path d="M4 2.5v11l9-5.5-9-5.5z" />
				</svg>
			)}
			Resume sync
		</button>
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
	const meta = STATUS_META[status];
	const intervalSec = Math.round(integration.syncIntervalMs / 1000);
	const typeLabel = integration.type.charAt(0).toUpperCase() + integration.type.slice(1);
	const dimMetrics = status !== "active";

	const lastSyncDisplay = integration.lastSyncAt
		? formatRelativeTime(integration.lastSyncAt)
		: "Never";
	const lastSyncTitle = integration.lastSyncAt
		? formatDateTime(integration.lastSyncAt)
		: undefined;

	return (
		<Card
			padding="none"
			className={cn(
				"relative overflow-hidden",
				status === "paused" &&
					"border-warning/25 bg-[color-mix(in_srgb,var(--color-warning)_3%,var(--color-surface-900))]",
				status === "error" &&
					"border-danger/25 bg-[color-mix(in_srgb,var(--color-danger)_3%,var(--color-surface-900))]",
			)}
		>
			<div
				className="absolute inset-y-0 left-0 w-[3px] opacity-90"
				style={{ background: meta.color, boxShadow: `0 0 18px ${meta.color}` }}
			/>

			<div className="py-4 pl-[22px] pr-5">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2.5">
							<span
								className={cn(
									"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
									status === "active" &&
										"border-accent-bright/25 bg-accent-bright/10 text-accent-bright",
									status === "paused" && "border-warning/25 bg-warning/10 text-warning",
									status === "error" && "border-danger/25 bg-danger/10 text-danger",
								)}
								aria-hidden="true"
							>
								<LokiIcon />
							</span>
							<h3 className="truncate text-base font-semibold text-text-1">
								{integration.name}
							</h3>
							<StatusPill status={status} />
							{syncJustSucceeded && (
								<span className="text-xs text-success">Synced just now</span>
							)}
						</div>
						<div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-xs text-text-3">
							<span className="text-text-2">{typeLabel}</span>
							<span className="text-text-4">·</span>
							<span className="truncate text-accent-2" title={integration.url}>
								{integration.url}
							</span>
						</div>

						{status === "paused" && (
							<div className="mt-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="currentColor"
									aria-hidden="true"
								>
									<rect x="4" y="3" width="3" height="10" rx="1" />
									<rect x="9" y="3" width="3" height="10" rx="1" />
								</svg>
								<span>Sync paused. No events ingested while paused.</span>
							</div>
						)}

						{status === "error" && integration.lastSyncError && (
							<div
								role="alert"
								className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
									className="mt-0.5 shrink-0"
								>
									<path
										d="M8 2l7 12H1L8 2z"
										stroke="currentColor"
										strokeWidth="1.4"
										strokeLinejoin="round"
									/>
									<path
										d="M8 6v4M8 12v.5"
										stroke="currentColor"
										strokeWidth="1.4"
										strokeLinecap="round"
									/>
								</svg>
								<span className="whitespace-pre-wrap break-all font-mono text-text-2">
									{integration.lastSyncError}
								</span>
							</div>
						)}
					</div>

					<Menu
						trigger={({ open, toggle }) => (
							<button
								type="button"
								onClick={toggle}
								aria-label="Integration actions"
								aria-haspopup="menu"
								aria-expanded={open}
								className={cn(
									"-mr-1 rounded p-1.5 text-text-3 transition-colors hover:bg-surface-800 hover:text-text-1",
									open && "bg-surface-800 text-text-1",
								)}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="currentColor"
									aria-hidden="true"
								>
									<circle cx="8" cy="3" r="1.2" />
									<circle cx="8" cy="8" r="1.2" />
									<circle cx="8" cy="13" r="1.2" />
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

				<div
					className={cn(
						"mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4",
						dimMetrics && "opacity-[0.55]",
					)}
				>
					<Metric label="Auth" value={integration.authType === "basic" ? "Basic" : "None"} />
					<Metric label="Interval" value={`${intervalSec}s`} />
					<Metric label="Last sync" value={lastSyncDisplay} title={lastSyncTitle} />
					<Metric label="Ingested · 30d" value={integration.eventCount.toLocaleString()} />
				</div>

				<pre className="mt-3.5 overflow-x-auto rounded-md border border-edge-dim bg-surface-950/60 px-3 py-2.5 font-mono text-xs text-text-2">
					<code className="whitespace-nowrap">{integration.lokiQuery}</code>
				</pre>

				<div
					className={cn(
						"mt-4 flex flex-wrap items-center gap-2",
						status === "paused" &&
							"rounded-md border border-warning/25 bg-warning/[0.07] p-3",
					)}
				>
					{status === "paused" ? (
						<>
							<ResumeButton loading={resuming} onClick={onResume} />
							<Button variant="ghost" size="sm" disabled title="Sync is paused">
								Sync now
							</Button>
							<Button variant="ghost" size="sm" onClick={onEdit}>
								Edit
							</Button>
						</>
					) : status === "error" ? (
						<>
							<Button size="sm" loading={syncing} onClick={onSyncNow}>
								Retry now
							</Button>
							<Button variant="ghost" size="sm" onClick={onEdit}>
								Edit
							</Button>
						</>
					) : (
						<>
							<Button size="sm" loading={syncing} onClick={onSyncNow}>
								Sync now
							</Button>
							<Button
								variant="ghost"
								size="sm"
								loading={pausing}
								onClick={onPause}
								leftIcon={
									<svg
										width="12"
										height="12"
										viewBox="0 0 16 16"
										fill="currentColor"
										aria-hidden="true"
									>
										<rect x="4" y="3" width="3" height="10" rx="1" />
										<rect x="9" y="3" width="3" height="10" rx="1" />
									</svg>
								}
							>
								Pause sync
							</Button>
							<Button variant="ghost" size="sm" onClick={onEdit}>
								Edit
							</Button>
						</>
					)}
				</div>
			</div>
		</Card>
	);
}
