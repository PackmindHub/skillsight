import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DROPDOWN_PANEL } from "./_styles";
import { type AnyStatus, statusLabel } from "./StatusBadge";

interface StatusFilterProps<S extends AnyStatus> {
	value: S | "all";
	onChange: (next: S | "all") => void;
	options: readonly S[];
	allLabel?: string;
	ariaLabel?: string;
	className?: string;
}

const STATUS_DOT: Record<AnyStatus, { background: string; boxShadow?: string }> = {
	approved: { background: "var(--color-success)", boxShadow: "0 0 4px var(--color-success)" },
	to_review: { background: "var(--color-warning)", boxShadow: "0 0 4px var(--color-warning)" },
	removed: { background: "var(--color-danger)", boxShadow: "0 0 4px var(--color-danger)" },
	denied: { background: "var(--color-danger)", boxShadow: "0 0 4px var(--color-danger)" },
};

export function StatusFilter<S extends AnyStatus>({
	value,
	onChange,
	options,
	allLabel = "All",
	ariaLabel = "Filter by status",
	className,
}: StatusFilterProps<S>) {
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

	const active = value !== "all";
	const summary = active ? statusLabel(value as AnyStatus) : allLabel;

	return (
		<div ref={containerRef} className={cn("relative inline-block", className)}>
			<button
				type="button"
				aria-label={ariaLabel}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface-800 px-3 text-sm text-text-1 hover:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-accent-bright",
					active && "border-accent-bright/40 bg-accent-bright/5",
				)}
			>
				<span className="text-text-3">Status:</span>
				{active && (
					<span
						aria-hidden="true"
						className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
						style={STATUS_DOT[value as AnyStatus]}
					/>
				)}
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
					<button
						type="button"
						role="menuitem"
						aria-checked={value === "all"}
						onClick={() => {
							onChange("all");
							setOpen(false);
						}}
						className={cn(
							"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-700",
							value === "all" ? "text-text-1" : "text-text-2",
						)}
					>
						<span
							aria-hidden="true"
							className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
							style={{ background: "var(--color-text-3)" }}
						/>
						<span className="flex-1 truncate">{allLabel}</span>
					</button>
					{options.map((s) => (
						<button
							key={s}
							type="button"
							role="menuitem"
							aria-checked={value === s}
							onClick={() => {
								onChange(s);
								setOpen(false);
							}}
							className={cn(
								"flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-700",
								value === s ? "text-text-1" : "text-text-2",
							)}
						>
							<span
								aria-hidden="true"
								className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
								style={STATUS_DOT[s]}
							/>
							<span className="flex-1 truncate">{statusLabel(s)}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
