import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DROPDOWN_PANEL } from "./_styles";

interface MultiSelectOption {
	value: string;
	label: string;
}

interface MultiSelectProps {
	label: string;
	options: MultiSelectOption[];
	values: string[];
	onChange: (values: string[]) => void;
	className?: string;
}

export function MultiSelect({ label, options, values, onChange, className }: MultiSelectProps) {
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

	function toggle(value: string) {
		const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
		onChange(next);
	}

	const summary =
		values.length === 0
			? "All"
			: values.length === 1
				? (options.find((o) => o.value === values[0])?.label ?? values[0])
				: `${values.length} selected`;

	return (
		<div ref={containerRef} className={cn("relative inline-block", className)}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className={cn(
					"inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface-800 px-3 text-sm text-text-1 hover:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-accent-bright",
					values.length > 0 && "border-accent-bright/40 bg-accent-bright/5",
				)}
			>
				<span className="text-text-3">{label}:</span>
				<span className="text-text-1 max-w-[12rem] truncate">{summary}</span>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
					<path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>
			{open && (
				<div className={cn(DROPDOWN_PANEL, "left-0 min-w-[14rem] max-h-72 overflow-y-auto")}>
					{options.length === 0 ? (
						<p className="px-3 py-2 text-xs text-text-4">No options available</p>
					) : (
						options.map((opt) => {
							const selected = values.includes(opt.value);
							return (
								<button
									key={opt.value}
									type="button"
									aria-pressed={selected}
									onClick={() => toggle(opt.value)}
									className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-2 hover:bg-surface-700"
								>
									<span
										className={cn(
											"inline-flex h-3.5 w-3.5 items-center justify-center rounded border",
											selected
												? "border-accent-bright bg-accent-bright text-surface-900"
												: "border-edge bg-surface-900",
										)}
										aria-hidden="true"
									>
										{selected && (
											<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
												<title>Selected</title>
												<path d="M2 5.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
											</svg>
										)}
									</span>
									<span className="truncate">{opt.label}</span>
								</button>
							);
						})
					)}
					{values.length > 0 && (
						<div className="border-t border-edge-dim mt-1 pt-1">
							<button
								type="button"
								onClick={() => onChange([])}
								className="w-full px-3 py-1.5 text-left text-xs text-text-3 hover:text-text-1 hover:bg-surface-700"
							>
								Clear
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
