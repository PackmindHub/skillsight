import { useEffect, useMemo, useRef, useState } from "react";
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

const SEARCH_THRESHOLD = 8;

export function MultiSelect({ label, options, values, onChange, className }: MultiSelectProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (!open) {
			setQuery("");
			return;
		}
		function onClick(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		window.addEventListener("keydown", onKey);
		// Autofocus search input so the user can type immediately.
		searchInputRef.current?.focus();
		return () => {
			document.removeEventListener("mousedown", onClick);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	function toggle(value: string) {
		const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
		onChange(next);
	}

	const showSearch = options.length > SEARCH_THRESHOLD;
	const filteredOptions = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return options;
		return options.filter(
			(o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
		);
	}, [options, query]);

	const canSelectAll =
		filteredOptions.length > 0 &&
		filteredOptions.some((o) => !values.includes(o.value));

	function selectAllFiltered() {
		const merged = new Set(values);
		for (const o of filteredOptions) merged.add(o.value);
		onChange([...merged]);
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
				<div className={cn(DROPDOWN_PANEL, "left-0 min-w-[14rem] flex flex-col")}>
					{showSearch && (
						<div className="border-b border-edge-dim p-2">
							<input
								ref={searchInputRef}
								type="text"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={`Search ${label.toLowerCase()}…`}
								className="h-7 w-full rounded border border-edge bg-surface-900 px-2 text-xs text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-1 focus:ring-accent-bright focus:border-accent-bright"
							/>
						</div>
					)}
					<div className="max-h-64 overflow-y-auto">
						{options.length === 0 ? (
							<p className="px-3 py-2 text-xs text-text-4">No options available</p>
						) : filteredOptions.length === 0 ? (
							<p className="px-3 py-2 text-xs text-text-4">No matches</p>
						) : (
							filteredOptions.map((opt) => {
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
					</div>
					{(canSelectAll || values.length > 0) && (
						<div className="flex border-t border-edge-dim">
							{canSelectAll && (
								<button
									type="button"
									onClick={selectAllFiltered}
									className="flex-1 px-3 py-1.5 text-left text-xs text-text-3 hover:text-text-1 hover:bg-surface-700"
								>
									{query.trim()
										? `Select all (${filteredOptions.length})`
										: "Select all"}
								</button>
							)}
							{values.length > 0 && (
								<button
									type="button"
									onClick={() => onChange([])}
									className="flex-1 px-3 py-1.5 text-right text-xs text-text-3 hover:text-text-1 hover:bg-surface-700"
								>
									Clear
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
