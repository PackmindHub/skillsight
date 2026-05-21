import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type StatusChipTone = "success" | "warning" | "danger" | "neutral";

export interface StatusChipOption<T extends string> {
	value: T;
	label: string;
	tone: StatusChipTone;
}

type StatusChipSize = "sm" | "md";

interface StatusChipProps<T extends string> {
	value: T;
	options: readonly StatusChipOption<T>[];
	onChange?: (value: T) => void;
	align?: "left" | "right";
	disabled?: boolean;
	className?: string;
	ariaLabel?: string;
	title?: string;
	/**
	 * Label shown when `value` does not match any option (e.g. for a "Set status" picker
	 * where there is no current selection). Defaults to the raw value.
	 */
	placeholderLabel?: string;
	/**
	 * Optional dimmed prefix rendered only on the trigger (not in the menu). Used when the
	 * chip doubles as a filter control and needs to read like "Status: Approved".
	 */
	triggerPrefix?: string;
	/**
	 * Visual size. `sm` (default) is the compact in-table chip; `md` matches Button
	 * `size="sm"` (h-8 px-3) so the chip can sit on a row of buttons without looking shorter.
	 */
	size?: StatusChipSize;
}

const TONE_DOT_STYLE: Record<StatusChipTone, { background: string; boxShadow?: string }> = {
	success: { background: "var(--color-success)", boxShadow: "0 0 6px var(--color-success)" },
	warning: { background: "var(--color-warning)", boxShadow: "0 0 6px var(--color-warning)" },
	danger: { background: "var(--color-danger)", boxShadow: "0 0 6px var(--color-danger)" },
	neutral: { background: "var(--color-text-3)" },
};

const TONE_CHIP: Record<StatusChipTone, string> = {
	success: "text-success border-success/30 bg-success/10 hover:bg-success/15",
	warning: "text-warning border-warning/30 bg-warning/10 hover:bg-warning/15",
	danger: "text-danger border-danger/30 bg-danger/10 hover:bg-danger/15",
	neutral: "text-text-3 border-edge-dim bg-surface-800 hover:bg-surface-700 hover:text-text-2",
};

const MENU_MIN_WIDTH = 168;

const SIZE_TRIGGER: Record<StatusChipSize, string> = {
	sm: "px-2 py-1 text-[11px] leading-tight",
	md: "h-8 px-3 text-[13px] leading-none",
};

export function StatusChip<T extends string>({
	value,
	options,
	onChange,
	align = "left",
	disabled,
	className,
	ariaLabel,
	title,
	placeholderLabel,
	triggerPrefix,
	size = "sm",
}: StatusChipProps<T>) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(
		null,
	);

	useLayoutEffect(() => {
		if (!open) return;
		function reposition() {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const minWidth = Math.max(MENU_MIN_WIDTH, rect.width);
			const left = align === "right" ? rect.right - minWidth : rect.left;
			const menuHeight = menuRef.current?.offsetHeight ?? 0;
			const spaceBelow = window.innerHeight - rect.bottom;
			const placeAbove = menuHeight > 0 && spaceBelow < menuHeight + 12 && rect.top > spaceBelow;
			const top = placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4;
			setMenuPos({ top, left, minWidth });
		}
		reposition();
		window.addEventListener("scroll", reposition, true);
		window.addEventListener("resize", reposition);
		return () => {
			window.removeEventListener("scroll", reposition, true);
			window.removeEventListener("resize", reposition);
		};
	}, [open, align]);

	// After the menu mounts we know its real height, so re-run the flip check
	// against the trigger's current position. Skips when no adjustment is needed.
	useLayoutEffect(() => {
		if (!open || !menuPos || !menuRef.current || !triggerRef.current) return;
		const triggerRect = triggerRef.current.getBoundingClientRect();
		const menuHeight = menuRef.current.offsetHeight;
		const spaceBelow = window.innerHeight - triggerRect.bottom;
		const placeAbove = spaceBelow < menuHeight + 12 && triggerRect.top > spaceBelow;
		const desiredTop = placeAbove ? triggerRect.top - menuHeight - 4 : triggerRect.bottom + 4;
		if (Math.abs(desiredTop - menuPos.top) > 0.5) {
			setMenuPos({ ...menuPos, top: desiredTop });
		}
	}, [open, menuPos]);

	useEffect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			const target = e.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if (menuRef.current?.contains(target)) return;
			setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		window.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const current =
		options.find((o) => o.value === value) ??
		({
			value,
			label: placeholderLabel ?? value,
			tone: "neutral",
		} as StatusChipOption<T>);

	const interactive = !disabled && Boolean(onChange);

	return (
		<div className={cn("relative inline-block", className)}>
			<button
				ref={triggerRef}
				type="button"
				disabled={!interactive}
				aria-haspopup={interactive ? "menu" : undefined}
				aria-expanded={interactive ? open : undefined}
				aria-label={ariaLabel}
				title={title}
				onClick={(e) => {
					e.stopPropagation();
					if (interactive) setOpen((o) => !o);
				}}
				className={cn(
					"inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-mono transition-colors",
					SIZE_TRIGGER[size],
					"focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/60",
					TONE_CHIP[current.tone],
					interactive ? "cursor-pointer" : "cursor-default opacity-90",
				)}
			>
				<span
					aria-hidden="true"
					className="h-[7px] w-[7px] shrink-0 rounded-full"
					style={TONE_DOT_STYLE[current.tone]}
				/>
				{triggerPrefix && <span className="opacity-60">{triggerPrefix}</span>}
				<span>{current.label}</span>
				{interactive && (
					<svg
						width="9"
						height="9"
						viewBox="0 0 10 6"
						fill="none"
						aria-hidden="true"
						className="opacity-60"
					>
						<path
							d="M1 1l4 4 4-4"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</button>
			{open &&
				menuPos &&
				createPortal(
					<div
						ref={menuRef}
						role="menu"
						style={{
							position: "fixed",
							top: menuPos.top,
							left: menuPos.left,
							minWidth: menuPos.minWidth,
						}}
						className="z-50 rounded-md border border-edge bg-surface-800 p-1 shadow-xl"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{options.map((o) => {
							const active = o.value === current.value;
							return (
								<button
									key={o.value}
									type="button"
									role="menuitem"
									aria-checked={active}
									onClick={(e) => {
										e.stopPropagation();
										onChange?.(o.value);
										setOpen(false);
									}}
									className={cn(
										"flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs transition-colors",
										active
											? "bg-accent-bright/10 text-text-1"
											: "text-text-2 hover:bg-accent-bright/10 hover:text-text-1",
									)}
								>
									<span
										aria-hidden="true"
										className="h-[7px] w-[7px] shrink-0 rounded-full"
										style={TONE_DOT_STYLE[o.tone]}
									/>
									<span className="flex-1">{o.label}</span>
									{active && (
										<svg
											width="12"
											height="12"
											viewBox="0 0 16 16"
											fill="none"
											aria-hidden="true"
											className="text-accent-bright"
										>
											<path
												d="M3 8.5L6.5 12 13 4.5"
												stroke="currentColor"
												strokeWidth="1.8"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									)}
								</button>
							);
						})}
					</div>,
					document.body,
				)}
		</div>
	);
}
