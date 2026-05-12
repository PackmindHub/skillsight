import { cn } from "@/lib/utils";

export type CardStatus = "active" | "paused" | "error";

export const STATUS_META: Record<
	CardStatus,
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

export function StatusPill({
	status,
	pulse = true,
	label,
}: {
	status: CardStatus;
	pulse?: boolean;
	label?: string;
}) {
	const meta = STATUS_META[status];
	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]"
			style={{ color: meta.color, background: meta.pillBg, borderColor: meta.pillBorder }}
		>
			<span
				className={cn("h-1.5 w-1.5 rounded-full", status === "active" && pulse && "animate-pulse")}
				style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
			/>
			{label ?? meta.label}
		</span>
	);
}

export function Metric({
	label,
	value,
	title,
}: {
	label: string;
	value: string;
	title?: string;
}) {
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
