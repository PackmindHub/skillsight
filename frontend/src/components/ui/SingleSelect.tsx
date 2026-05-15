import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DROPDOWN_PANEL, TRIGGER_BASE } from "./_styles";

interface SingleSelectOption<V extends string> {
	value: V;
	label: string;
}

interface SingleSelectProps<V extends string> {
	label: string;
	options: readonly SingleSelectOption<V>[];
	value: V;
	onChange: (value: V) => void;
	/**
	 * Values that count as "default / no filter applied". When the current value matches
	 * one of these, the trigger renders in its neutral style. Defaults to any value
	 * named "all".
	 */
	defaultValues?: readonly V[];
	ariaLabel?: string;
	className?: string;
}

export function SingleSelect<V extends string>({
	label,
	options,
	value,
	onChange,
	defaultValues,
	ariaLabel,
	className,
}: SingleSelectProps<V>) {
	const defaults = defaultValues ?? (["all"] as unknown as readonly V[]);
	const containerRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
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

	const current = options.find((o) => o.value === value);
	const summary = current?.label ?? value;
	const active = !defaults.includes(value);

	return (
		<div ref={containerRef} className={cn("relative inline-block", className)}>
			<button
				type="button"
				aria-label={ariaLabel ?? `Filter by ${label.toLowerCase()}`}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={cn(
					TRIGGER_BASE,
					active && "border-accent-bright/40 bg-accent-bright/5",
				)}
			>
				<span className="text-text-3">{label}:</span>
				<span className="text-text-1 max-w-[12rem] truncate">{summary}</span>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
					<path
						d="M2 4l3 3 3-3"
						stroke="currentColor"
						strokeWidth="1.25"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			{open && (
				<div role="menu" className={cn(DROPDOWN_PANEL, "left-0 min-w-[12rem]")}>
					{options.map((opt) => {
						const selected = opt.value === value;
						return (
							<button
								key={opt.value}
								type="button"
								role="menuitem"
								aria-checked={selected}
								onClick={() => {
									onChange(opt.value);
									setOpen(false);
								}}
								className={cn(
									"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-700",
									selected ? "text-text-1" : "text-text-2",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
										selected ? "text-accent-bright" : "text-transparent",
									)}
								>
									<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
										<path
											d="M3 8.5L6.5 12 13 4.5"
											stroke="currentColor"
											strokeWidth="1.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</span>
								<span className="truncate">{opt.label}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
