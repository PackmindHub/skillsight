import { cn } from "@/lib/utils";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

export interface HelpTipProps {
	title?: ReactNode;
	body: ReactNode;
	hint?: ReactNode;
	size?: "xs" | "sm" | "md";
	placement?: "auto" | "bottom" | "top";
	className?: string;
}

const SIZE: Record<NonNullable<HelpTipProps["size"]>, string> = {
	xs: "h-4 w-4 top-1.5 right-1.5 [&_.helptip-glyph]:text-[10px]",
	sm: "h-5 w-5 top-2 right-2 [&_.helptip-glyph]:text-[12px]",
	md: "h-[22px] w-[22px] top-2 right-2 [&_.helptip-glyph]:text-[13px]",
};

const TIP_WIDTH = 300;
const SCREEN_MARGIN = 10;

interface Coords {
	left: number;
	top: number;
	place: "top" | "bottom";
	arrowLeft: number;
}

export function HelpTip({
	title,
	body,
	hint,
	size = "sm",
	placement = "auto",
	className,
}: HelpTipProps) {
	const [open, setOpen] = useState(false);
	const [coords, setCoords] = useState<Coords | null>(null);
	const btnRef = useRef<HTMLButtonElement>(null);

	const reposition = useCallback(() => {
		const btn = btnRef.current;
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const spaceBelow = vh - r.bottom;
		const spaceAbove = r.top;
		const place: "top" | "bottom" =
			placement === "bottom"
				? "bottom"
				: placement === "top"
					? "top"
					: spaceBelow >= 160 || spaceBelow >= spaceAbove
						? "bottom"
						: "top";

		let left = r.right - TIP_WIDTH;
		if (left < SCREEN_MARGIN) left = SCREEN_MARGIN;
		if (left + TIP_WIDTH > vw - SCREEN_MARGIN) left = vw - SCREEN_MARGIN - TIP_WIDTH;

		const iconCx = r.left + r.width / 2;
		const arrowLeft = Math.max(14, Math.min(TIP_WIDTH - 14, iconCx - left));
		const top = place === "bottom" ? r.bottom + 8 : r.top - 8;

		setCoords({ left, top, place, arrowLeft });
	}, [placement]);

	useLayoutEffect(() => {
		if (!open) return;
		reposition();
		const onScroll = () => reposition();
		const onResize = () => reposition();
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onResize);
		};
	}, [open, reposition]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setOpen((v) => !v);
	};

	const popStyle: CSSProperties =
		coords != null
			? {
					left: coords.left,
					top: coords.top,
					transform: coords.place === "top" ? "translateY(-100%)" : undefined,
				}
			: {};

	const ariaLabel = typeof title === "string" ? `What is ${title}?` : "More information";

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				aria-label={ariaLabel}
				aria-expanded={open}
				onClick={handleClick}
				onMouseEnter={() => setOpen(true)}
				onMouseLeave={() => setOpen(false)}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				className={cn(
					"absolute z-[4] inline-flex items-center justify-center rounded-full border p-0",
					"text-text-4 cursor-help outline-none appearance-none",
					"border-edge-dim bg-[color-mix(in_srgb,var(--color-surface-950)_60%,transparent)]",
					"transition-[color,border-color,background-color] duration-100",
					"hover:text-accent-soft hover:border-[color-mix(in_srgb,var(--color-accent-bright)_50%,var(--color-edge))] hover:bg-[color-mix(in_srgb,var(--color-accent-bright)_8%,var(--color-surface-950))]",
					"focus-visible:text-accent-soft focus-visible:border-[color-mix(in_srgb,var(--color-accent-bright)_50%,var(--color-edge))] focus-visible:bg-[color-mix(in_srgb,var(--color-accent-bright)_8%,var(--color-surface-950))] focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent-bright)_35%,transparent)]",
					open &&
						"text-accent-soft border-[color-mix(in_srgb,var(--color-accent-bright)_50%,var(--color-edge))] bg-[color-mix(in_srgb,var(--color-accent-bright)_8%,var(--color-surface-950))]",
					SIZE[size],
					className,
				)}
			>
				<span
					aria-hidden="true"
					className="helptip-glyph block translate-y-[0.5px] font-mono font-semibold leading-none"
				>
					?
				</span>
			</button>
			{open &&
				coords &&
				createPortal(
					<div
						role="tooltip"
						style={popStyle}
						onMouseEnter={() => setOpen(true)}
						onMouseLeave={() => setOpen(false)}
						className={cn(
							"fixed z-[9999] w-[300px] rounded-[10px] border border-edge",
							"px-3.5 pb-3 pt-3 font-sans text-text-1",
							"bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-800)_92%,black),color-mix(in_srgb,var(--color-surface-900)_96%,black))]",
							"backdrop-blur-md",
							"shadow-[0_1px_0_color-mix(in_srgb,var(--color-accent-bright)_14%,transparent)_inset,0_16px_40px_rgba(0,0,0,0.62),0_0_0_1px_color-mix(in_srgb,var(--color-accent-bright)_8%,transparent)]",
							"origin-top-right",
							coords.place === "top" && "origin-bottom-right",
						)}
					>
						<span
							aria-hidden="true"
							style={{ left: coords.arrowLeft }}
							className={cn(
								"absolute block h-2.5 w-2.5 -translate-x-1/2 rotate-45",
								"bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-surface-800)_92%,black),color-mix(in_srgb,var(--color-surface-900)_96%,black))]",
								coords.place === "bottom" && "top-[-6px] border-l border-t border-edge",
								coords.place === "top" && "bottom-[-6px] border-b border-r border-edge",
							)}
						/>
						{title && (
							<div className="mb-2 inline-flex items-center gap-[7px] font-mono text-[10px] uppercase tracking-[0.1em] text-accent-soft">
								<span
									aria-hidden="true"
									className="h-[5px] w-[5px] rounded-full bg-accent-bright shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent-bright)_60%,transparent)]"
								/>
								{title}
							</div>
						)}
						<div className="text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{body}</div>
						{hint && (
							<div className="mt-2.5 flex items-center gap-1.5 border-t border-dashed border-edge-dim pt-[9px] font-mono text-[10px] uppercase tracking-[0.06em] text-text-4 before:block before:h-1 before:w-1 before:rounded-full before:bg-current before:opacity-70 before:content-['']">
								{hint}
							</div>
						)}
					</div>,
					document.body,
				)}
		</>
	);
}
