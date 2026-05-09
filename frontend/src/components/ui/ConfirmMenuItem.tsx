import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { MENU_ITEM_BASE } from "./_styles";
import { useMenuClose } from "./Menu";

interface ConfirmMenuItemProps {
	label: ReactNode;
	confirmLabel?: string;
	loading?: boolean;
	disabled?: boolean;
	variant?: "warning" | "danger";
	onConfirm: () => void;
}

const labelColor: Record<NonNullable<ConfirmMenuItemProps["variant"]>, string> = {
	warning: "text-warning",
	danger: "text-danger",
};

const confirmBtnColor: Record<NonNullable<ConfirmMenuItemProps["variant"]>, string> = {
	warning: "text-warning hover:bg-warning/10",
	danger: "text-danger hover:bg-danger/10",
};

export function ConfirmMenuItem({
	label,
	confirmLabel = "Confirm",
	loading = false,
	disabled = false,
	variant = "warning",
	onConfirm,
}: ConfirmMenuItemProps) {
	const close = useMenuClose();
	const [armed, setArmed] = useState(false);

	if (!armed) {
		return (
			<button
				type="button"
				role="menuitem"
				disabled={disabled}
				onClick={() => setArmed(true)}
				className={cn(MENU_ITEM_BASE, labelColor[variant])}
			>
				{label}
			</button>
		);
	}

	return (
		<div className="flex items-center gap-1 px-2 py-1">
			<span className="flex-1 text-xs text-text-3">Are you sure?</span>
			<button
				type="button"
				disabled={loading}
				onClick={() => {
					onConfirm();
					setArmed(false);
					close();
				}}
				className={`rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 ${confirmBtnColor[variant]}`}
			>
				{loading ? "…" : confirmLabel}
			</button>
			<button
				type="button"
				onClick={() => setArmed(false)}
				className="rounded px-2 py-0.5 text-xs text-text-3 hover:bg-surface-700 hover:text-text-1 transition-colors"
			>
				Cancel
			</button>
		</div>
	);
}
