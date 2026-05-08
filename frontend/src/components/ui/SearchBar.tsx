import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Suggestion {
	id: string;
	label: ReactNode;
	hint?: ReactNode;
}

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	suggestions?: Suggestion[];
	onSelectSuggestion?: (id: string) => void;
	shortcutKey?: string; // e.g. "/"
	className?: string;
}

export function SearchBar({
	value,
	onChange,
	placeholder = "Search…",
	suggestions = [],
	onSelectSuggestion,
	shortcutKey = "/",
	className,
}: SearchBarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [highlight, setHighlight] = useState(0);

	useEffect(() => {
		const key = shortcutKey;
		if (!key) return;
		function onKey(e: KeyboardEvent) {
			if (e.key !== key) return;
			const tag = (document.activeElement?.tagName ?? "").toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select") return;
			e.preventDefault();
			inputRef.current?.focus();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [shortcutKey]);

	useEffect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [open]);

	useEffect(() => {
		setHighlight(0);
	}, [value]);

	const showSuggestions = open && value.length > 0 && suggestions.length > 0;

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!showSuggestions) {
			if (e.key === "ArrowDown" && suggestions.length > 0) {
				setOpen(true);
				e.preventDefault();
			}
			if (e.key === "Escape") inputRef.current?.blur();
			return;
		}
		if (e.key === "ArrowDown") {
			setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
			e.preventDefault();
		} else if (e.key === "ArrowUp") {
			setHighlight((h) => Math.max(h - 1, 0));
			e.preventDefault();
		} else if (e.key === "Enter") {
			const pick = suggestions[highlight];
			if (pick && onSelectSuggestion) {
				onSelectSuggestion(pick.id);
				setOpen(false);
				e.preventDefault();
			}
		} else if (e.key === "Escape") {
			setOpen(false);
			e.preventDefault();
		}
	}

	return (
		<div ref={containerRef} className={cn("relative w-full", className)}>
			<div className="relative">
				<svg
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-4"
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					aria-hidden="true"
				>
					<circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
					<path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
				</svg>
				<input
					ref={inputRef}
					type="text"
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="w-full rounded-md border border-edge bg-surface-800 pl-9 pr-20 py-2 text-sm text-text-1 placeholder:text-text-4 focus:outline-none focus:ring-1 focus:ring-accent-bright focus:border-accent-bright"
				/>
				<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
					{value && (
						<button
							type="button"
							aria-label="Clear search"
							onClick={() => {
								onChange("");
								inputRef.current?.focus();
							}}
							className="rounded p-1 text-text-4 hover:text-text-1 hover:bg-surface-700"
						>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
								<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
							</svg>
						</button>
					)}
					{!value && shortcutKey && (
						<kbd className="hidden sm:inline-flex items-center rounded border border-edge bg-surface-700 px-1.5 py-0.5 text-[10px] font-mono text-text-4">
							{shortcutKey}
						</kbd>
					)}
				</div>
			</div>
			{showSuggestions && (
				<div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-edge bg-surface-800 py-1 shadow-xl">
					{suggestions.map((s, i) => (
						<button
							key={s.id}
							type="button"
							aria-selected={i === highlight}
							onMouseEnter={() => setHighlight(i)}
							onMouseDown={(e) => {
								e.preventDefault();
								onSelectSuggestion?.(s.id);
								setOpen(false);
							}}
							className={cn(
								"flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors",
								i === highlight ? "bg-surface-700 text-text-1" : "text-text-2 hover:bg-surface-700",
							)}
						>
							<span className="font-mono truncate">{s.label}</span>
							{s.hint && <span className="text-xs text-text-4 shrink-0">{s.hint}</span>}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
