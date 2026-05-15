import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { HelpTip } from "./HelpTip";

export type StatCardTone = "linked" | "orphan" | "approved" | "active" | "warning" | "danger";

const TONE_STYLES: Record<StatCardTone, { dot: string; barFill: string }> = {
	linked: {
		dot: "bg-accent-bright shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-bright)_60%,transparent)]",
		barFill: "bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-bright))]",
	},
	orphan: {
		dot: "bg-caution shadow-[0_0_6px_color-mix(in_srgb,var(--color-caution)_60%,transparent)]",
		barFill: "bg-[linear-gradient(90deg,var(--color-caution),var(--color-warning))]",
	},
	approved: {
		dot: "bg-success shadow-[0_0_6px_color-mix(in_srgb,var(--color-success)_60%,transparent)]",
		barFill:
			"bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-success)_80%,black),var(--color-success))]",
	},
	active: {
		dot: "bg-accent-2 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-2)_60%,transparent)]",
		barFill: "bg-[linear-gradient(90deg,var(--color-accent-2),var(--color-accent-2-soft))]",
	},
	warning: {
		dot: "bg-warning shadow-[0_0_6px_color-mix(in_srgb,var(--color-warning)_60%,transparent)]",
		barFill: "bg-[linear-gradient(90deg,var(--color-warning),var(--color-caution))]",
	},
	danger: {
		dot: "bg-danger shadow-[0_0_6px_color-mix(in_srgb,var(--color-danger)_60%,transparent)]",
		barFill:
			"bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-danger)_85%,black),var(--color-danger))]",
	},
};

const ACTIVE_CARD =
	"border-[color-mix(in_srgb,var(--color-accent-bright)_55%,var(--color-edge))] bg-[color-mix(in_srgb,var(--color-accent-bright)_7%,var(--color-surface-900))]";

const BASE_CARD =
	"relative grid grid-cols-[1fr_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-1 overflow-hidden rounded-xl border border-edge bg-[linear-gradient(180deg,var(--color-surface-800),var(--color-surface-900))] pb-3.5 pl-4 pr-[34px] pt-3 text-left transition-[border-color,background-color] duration-150";

export interface StatCardProps {
	tone: StatCardTone;
	label: ReactNode;
	value: number;
	/**
	 * Denominator. When provided, renders "/ total" and a proportional bar.
	 * Omit for standalone values (no bar, no percentage badge).
	 */
	total?: number;
	active?: boolean;
	onToggle?: () => void;
	/**
	 * Help body — surfaced via a "?" HelpTip affordance in the top-right corner
	 * of the card.
	 */
	title?: string;
}

export function StatCard({ tone, label, value, total, active, onToggle, title }: StatCardProps) {
	const hasDenominator = typeof total === "number";
	const pct = hasDenominator && total > 0 ? Math.round((value / total) * 100) : null;
	const barWidth = hasDenominator ? (pct ?? 0) : 100;
	const styles = TONE_STYLES[tone];
	const clickable = typeof onToggle === "function";

	const content = (
		<>
			<span className="col-start-1 row-start-1 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-3">
				<span className={cn("h-[7px] w-[7px] flex-none rounded-full", styles.dot)} />
				{label}
			</span>
			{pct !== null && (
				<span
					className={cn(
						"col-start-2 row-start-1 rounded-full border border-edge bg-surface-900 px-1.5 py-0.5 font-mono text-[11px] tracking-[0.04em] text-text-3",
						active &&
							"border-[color-mix(in_srgb,var(--color-accent-bright)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-bright)_14%,var(--color-surface-900))] text-accent-soft",
					)}
				>
					{pct}%
				</span>
			)}
			<span className="col-span-2 row-start-2 flex items-baseline gap-2 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] text-text-1">
				{value.toLocaleString("en-US")}
				{hasDenominator && (
					<small className="font-mono text-xs font-normal text-text-4">
						/ {total.toLocaleString("en-US")}
					</small>
				)}
			</span>
			<span className="absolute inset-x-0 bottom-0 h-[3px] bg-[color-mix(in_srgb,var(--color-edge)_50%,transparent)]">
				<span
					className={cn(
						"block h-full transition-[width] duration-[400ms] ease-[cubic-bezier(.2,.7,.2,1)]",
						styles.barFill,
					)}
					style={{ width: `${barWidth}%` }}
				/>
			</span>
		</>
	);

	const helpTip = title ? <HelpTip title={label} body={title} /> : null;

	if (clickable) {
		return (
			<div className="relative">
				<button
					type="button"
					onClick={onToggle}
					aria-pressed={active ?? false}
					className={cn(
						BASE_CARD,
						"w-full cursor-pointer hover:border-edge-bright focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color-mix(in_srgb,var(--color-accent-bright)_60%,transparent)]",
						active && ACTIVE_CARD,
					)}
				>
					{content}
				</button>
				{helpTip}
			</div>
		);
	}

	return (
		<div className={cn(BASE_CARD, "cursor-default")}>
			{content}
			{helpTip}
		</div>
	);
}
