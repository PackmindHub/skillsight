import type { MarketplaceStatus, PluginStatus, SkillStatus } from "@/types/api";

export type AnyStatus = PluginStatus | MarketplaceStatus | SkillStatus;

const STATUS_BADGE_CLASS: Record<AnyStatus, string> = {
	to_review: "bg-amber-100 text-amber-700 border-amber-200",
	approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
	removed: "bg-red-100 text-red-600 border-red-200",
	denied: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<AnyStatus, string> = {
	to_review: "To Review",
	approved: "Approved",
	removed: "Removed",
	denied: "Denied",
};

export function statusLabel(status: AnyStatus): string {
	return STATUS_LABEL[status];
}

interface StatusBadgeProps {
	status: AnyStatus;
	className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
	return (
		<span
			className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]} ${className}`}
		>
			{STATUS_LABEL[status]}
		</span>
	);
}
