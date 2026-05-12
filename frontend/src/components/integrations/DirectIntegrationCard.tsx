import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmMenuItem } from "@/components/ui/ConfirmMenuItem";
import { Menu } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Metric, STATUS_META, StatusPill } from "./_parts";

function ClaudeIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path
				d="M4 16L8.4 4h1.6l4.4 12h-1.7l-1.1-3.2H7l-1.2 3.2H4Zm3.5-4.6h3.6L9.3 6 7.5 11.4Z"
				fill="currentColor"
			/>
		</svg>
	);
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	const onCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard unavailable (insecure context); silently no-op.
		}
	}, [value]);
	return (
		<Button variant="secondary" size="sm" onClick={onCopy} className="absolute top-3 right-3">
			{copied ? "Copied!" : "Copy"}
		</Button>
	);
}

export function DirectIntegrationCard() {
	const [eventCount, setEventCount] = useState<number | null>(null);
	const [lastEventAt, setLastEventAt] = useState<string | null>(null);
	const [clearing, setClearing] = useState(false);
	const [origin, setOrigin] = useState<string>(() =>
		typeof window !== "undefined" ? window.location.origin : "",
	);

	const refresh = useCallback(async () => {
		try {
			const stats = await api.integrations.getDirectStats();
			setEventCount(stats.eventCount);
			setLastEventAt(stats.lastEventAt);
		} catch {
			setEventCount(null);
			setLastEventAt(null);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			setOrigin(window.location.origin);
		}
	}, []);

	async function handleClearData() {
		setClearing(true);
		try {
			await api.integrations.clearDirectData();
			await refresh();
		} finally {
			setClearing(false);
		}
	}

	const meta = STATUS_META.active;
	const envBlock = `{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "${origin}/api/v0/telemetry/v1/logs",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <YOUR_INGESTION_TOKEN>",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORT_INTERVAL": "5000",
    "OTEL_LOG_TOOL_DETAILS": "1",
    "OTEL_METRICS_EXPORTER": "none"
  }
}`;

	const eventCountLabel =
		eventCount === null ? "—" : eventCount.toLocaleString();
	const lastEventDisplay = lastEventAt ? formatRelativeTime(lastEventAt) : "Never";
	const lastEventTitle = lastEventAt ? formatDateTime(lastEventAt) : undefined;

	return (
		<Card padding="none" className="relative overflow-hidden">
			<div
				className="absolute inset-y-0 left-0 w-[3px] opacity-90"
				style={{ background: meta.color, boxShadow: `0 0 18px ${meta.color}` }}
			/>

			<div className="py-4 pl-[22px] pr-5">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2.5">
							<span
								className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent-bright/25 bg-accent-bright/10 text-accent-bright"
								aria-hidden="true"
							>
								<ClaudeIcon />
							</span>
							<h3 className="truncate text-base font-semibold text-text-1">
								Claude Code (Direct)
							</h3>
							<span
								className="inline-flex items-center rounded-full border border-edge-dim bg-surface-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-3"
								title="Always available — no setup required on this side"
							>
								Built-in
							</span>
							<StatusPill status="active" pulse={false} label="Available" />
						</div>
						<div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-xs text-text-3">
							<span className="text-text-2">Direct push</span>
							<span className="text-text-4">·</span>
							<span className="truncate text-accent-2">
								POST /api/v0/telemetry/v1/logs
							</span>
						</div>
					</div>

					<Menu
						trigger={({ open, toggle }) => (
							<button
								type="button"
								onClick={toggle}
								aria-label="Direct integration actions"
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
						<ConfirmMenuItem
							label="Clear data"
							confirmLabel="Clear"
							loading={clearing}
							variant="warning"
							onConfirm={handleClearData}
						/>
					</Menu>
				</div>

				<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<Metric label="Auth" value="Bearer token" />
					<Metric label="Mode" value="Push (OTLP)" />
					<Metric label="Last event" value={lastEventDisplay} title={lastEventTitle} />
					<Metric label="Ingested · all-time" value={eventCountLabel} />
				</div>

				<div className="mt-4 rounded-md border border-edge-dim bg-surface-900/60 px-3 py-2 text-xs text-text-2">
					<p>
						Add the block below to your team's{" "}
						<code className="rounded border border-edge-dim bg-surface-800 px-1 font-mono text-[11px] text-accent-soft">
							settings.json
						</code>{" "}
						to send telemetry from Claude Code to this instance. Generate an ingestion token
						from the{" "}
						<Link
							to="/tokens"
							className="font-medium text-accent-2 underline-offset-2 hover:underline"
						>
							Tokens page
						</Link>
						.
					</p>
				</div>

				<div className="relative mt-3">
					<pre className="overflow-x-auto rounded-md border border-edge-dim bg-surface-950/60 p-3 font-mono text-xs text-text-2">
						{envBlock}
					</pre>
					<CopyButton value={envBlock} />
				</div>
			</div>
		</Card>
	);
}
