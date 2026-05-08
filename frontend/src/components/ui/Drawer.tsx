import { type ReactNode, useEffect, useRef } from "react";

interface DrawerProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	widthClass?: string;
}

export function Drawer({ open, onClose, title, children, footer, widthClass = "w-[520px]" }: DrawerProps) {
	const panelRef = useRef<HTMLDialogElement>(null);
	const previouslyFocused = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;

		previouslyFocused.current = document.activeElement as HTMLElement | null;

		const focusable = panelRef.current?.querySelector<HTMLElement>(
			"input, textarea, select, button, [tabindex]:not([tabindex='-1'])",
		);
		focusable?.focus();

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			previouslyFocused.current?.focus?.();
		};
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-40">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
			/>
			<dialog
				ref={panelRef}
				open
				aria-modal="true"
				aria-label={title}
				className={`absolute right-0 top-0 h-full ${widthClass} max-w-full m-0 flex flex-col bg-surface-900 border-l border-edge shadow-2xl text-text-1`}
			>
				<header className="flex items-center justify-between border-b border-edge px-5 py-4 shrink-0">
					<h2 className="text-sm font-semibold text-text-1">{title}</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close drawer"
						className="rounded p-1 text-text-3 hover:bg-surface-800 hover:text-text-1 transition-colors"
					>
						<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							<path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
					</button>
				</header>
				<div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
				{footer && (
					<footer className="border-t border-edge bg-surface-900 px-5 py-3 shrink-0">{footer}</footer>
				)}
			</dialog>
		</div>
	);
}
