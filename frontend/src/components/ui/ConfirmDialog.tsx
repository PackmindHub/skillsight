import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button, type ButtonVariant } from "./Button";

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	confirmVariant?: ButtonVariant;
	requireTyped?: string;
	loading?: boolean;
	error?: string | null;
	onConfirm: () => void | Promise<void>;
	onClose: () => void;
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	confirmVariant = "primary",
	requireTyped,
	loading = false,
	error,
	onConfirm,
	onClose,
}: ConfirmDialogProps) {
	const [typed, setTyped] = useState("");
	const panelRef = useRef<HTMLDialogElement>(null);
	const inputId = useId();
	const descriptionId = useId();

	useEffect(() => {
		if (!open) {
			setTyped("");
			return;
		}

		const focusable = panelRef.current?.querySelector<HTMLElement>(
			"input, button:not([disabled])",
		);
		focusable?.focus();

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape" && !loading) {
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
		};
	}, [open, onClose, loading]);

	if (!open) return null;

	const typedMatches = !requireTyped || typed.trim() === requireTyped;
	const disabled = !typedMatches || loading;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Close"
				onClick={() => {
					if (!loading) onClose();
				}}
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
			/>
			<dialog
				ref={panelRef}
				open
				aria-modal="true"
				aria-labelledby={`${inputId}-title`}
				aria-describedby={descriptionId}
				className="relative m-0 w-full max-w-md rounded-lg border border-edge bg-surface-900 p-0 text-text-1 shadow-2xl"
			>
				<header className="border-b border-edge px-5 py-4">
					<h2 id={`${inputId}-title`} className="text-sm font-semibold">
						{title}
					</h2>
				</header>
				<div id={descriptionId} className="px-5 py-4 text-sm text-text-2">
					{description}
				</div>
				{requireTyped && (
					<div className="px-5 pb-4">
						<label htmlFor={inputId} className="block text-xs text-text-3 mb-1.5">
							Type <span className="font-mono text-text-1">{requireTyped}</span> to confirm
						</label>
						<input
							id={inputId}
							type="text"
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							disabled={loading}
							autoComplete="off"
							className="w-full rounded-md border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:border-accent-bright focus:outline-none disabled:opacity-50"
						/>
					</div>
				)}
				{error && (
					<div className="mx-5 mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
						{error}
					</div>
				)}
				<footer className="flex items-center justify-end gap-2 border-t border-edge bg-surface-900 px-5 py-3">
					<Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
						{cancelLabel}
					</Button>
					<Button
						variant={confirmVariant}
						size="sm"
						onClick={() => onConfirm()}
						disabled={disabled}
						loading={loading}
					>
						{confirmLabel}
					</Button>
				</footer>
			</dialog>
		</div>
	);
}
