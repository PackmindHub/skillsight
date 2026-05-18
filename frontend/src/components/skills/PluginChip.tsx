import { cn } from "@/lib/utils";
import { ArrowUpRight, ListFilter, Plug } from "lucide-react";
import {
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

export interface PluginChipProps {
	pluginName: string;
	onFilter: (pluginName: string) => void;
}

const POP_WIDTH = 280;
const SCREEN_MARGIN = 10;
const CLOSE_DELAY_MS = 120;

interface Coords {
	left: number;
	top: number;
	place: "top" | "bottom";
}

export function PluginChip({ pluginName, onFilter }: PluginChipProps) {
	const [open, setOpen] = useState(false);
	const [coords, setCoords] = useState<Coords | null>(null);
	const btnRef = useRef<HTMLButtonElement>(null);
	const closeTimer = useRef<number | null>(null);
	const navigate = useNavigate();

	const cancelClose = useCallback(() => {
		if (closeTimer.current != null) {
			window.clearTimeout(closeTimer.current);
			closeTimer.current = null;
		}
	}, []);

	const scheduleClose = useCallback(() => {
		cancelClose();
		closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
	}, [cancelClose]);

	useEffect(() => () => cancelClose(), [cancelClose]);

	const reposition = useCallback(() => {
		const btn = btnRef.current;
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const spaceBelow = vh - r.bottom;
		const spaceAbove = r.top;
		// 200px is roughly the popover height (header + 2 actions)
		const place: "top" | "bottom" =
			spaceBelow >= 200 || spaceBelow >= spaceAbove ? "bottom" : "top";

		let left = r.left;
		if (left + POP_WIDTH > vw - SCREEN_MARGIN) left = vw - SCREEN_MARGIN - POP_WIDTH;
		if (left < SCREEN_MARGIN) left = SCREEN_MARGIN;

		const top = place === "bottom" ? r.bottom + 6 : r.top - 6;
		setCoords({ left, top, place });
	}, []);

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
			if (e.key === "Escape") {
				setOpen(false);
				btnRef.current?.blur();
			}
		};
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			if (btnRef.current?.contains(target)) return;
			const popEl = document.getElementById(`plugin-chip-pop-${pluginName}`);
			if (popEl?.contains(target)) return;
			setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [open, pluginName]);

	const handleChipClick = (e: ReactMouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		cancelClose();
		setOpen(true);
	};

	const handleFilter = (e: ReactMouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onFilter(pluginName);
		setOpen(false);
	};

	const handleOpenInPlugins = (e: ReactMouseEvent) => {
		// Allow ⌘/Ctrl/middle-click default behavior (new tab).
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
		e.preventDefault();
		e.stopPropagation();
		navigate(`/plugins?name=${encodeURIComponent(pluginName)}`);
		setOpen(false);
	};

	const popStyle: CSSProperties =
		coords != null
			? {
					left: coords.left,
					top: coords.top,
					width: POP_WIDTH,
					transform: coords.place === "top" ? "translateY(-100%)" : undefined,
				}
			: { width: POP_WIDTH };

	return (
		<>
			<button
				ref={btnRef}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={handleChipClick}
				onMouseEnter={() => {
					cancelClose();
					setOpen(true);
				}}
				onMouseLeave={scheduleClose}
				onFocus={() => {
					cancelClose();
					setOpen(true);
				}}
				onBlur={scheduleClose}
				title={`Bundled by plugin ${pluginName}`}
				className={cn(
					"group inline-flex w-fit max-w-full items-center gap-1.5 rounded border px-1.5 py-0.5",
					"appearance-none cursor-pointer outline-none",
					"border-accent-bright/30 bg-accent-bright/10 text-accent-soft",
					"font-mono text-[11px] leading-tight",
					"transition-[background-color,border-color] duration-100",
					"hover:border-accent-bright/45 hover:bg-accent-bright/20",
					"focus-visible:border-accent-bright/60 focus-visible:bg-accent-bright/20",
					open && "border-accent-bright/60 bg-accent-bright/20",
				)}
			>
				<Plug size={11} aria-hidden className="shrink-0 opacity-90" />
				<span className="truncate">{pluginName}</span>
				<span
					aria-hidden
					className={cn(
						"-mr-0.5 text-[9px] leading-none opacity-0 transition-opacity duration-100",
						"group-hover:opacity-70 group-focus-visible:opacity-70",
						open && "opacity-70",
					)}
				>
					▾
				</span>
			</button>
			{open &&
				coords &&
				createPortal(
					<div
						id={`plugin-chip-pop-${pluginName}`}
						role="menu"
						aria-label="Plugin actions"
						style={popStyle}
						onMouseEnter={cancelClose}
						onMouseLeave={scheduleClose}
						onFocus={cancelClose}
						onBlur={scheduleClose}
						className={cn(
							"fixed z-[9999] rounded-[9px] border border-edge bg-surface-800 p-1",
							"shadow-[0_18px_44px_rgba(0,0,0,0.55),0_0_0_1px_color-mix(in_srgb,var(--color-accent-bright)_8%,transparent)]",
						)}
					>
						{/* invisible bridge so the cursor can move between chip and popover */}
						<span
							aria-hidden
							className={cn(
								"absolute left-0 right-0 h-2",
								coords.place === "bottom" ? "-top-2" : "-bottom-2",
							)}
						/>
						<div className="mb-[3px] flex items-center gap-[7px] border-b border-dashed border-edge-dim px-[9px] pb-[7px] pt-[7px] font-mono text-[10px] uppercase tracking-[0.08em] text-text-4">
							Plugin
							<span className="font-mono text-[12px] normal-case tracking-normal text-accent-soft">
								{pluginName}
							</span>
						</div>
						<button
							type="button"
							role="menuitem"
							onClick={handleFilter}
							className="group flex w-full items-start gap-2.5 rounded-[5px] bg-transparent px-[9px] py-2 text-left text-[13px] text-text-1 hover:bg-surface-700"
						>
							<ListFilter
								size={14}
								aria-hidden
								className="mt-px shrink-0 text-text-3 transition-colors duration-100 group-hover:text-accent-bright"
							/>
							<span className="flex min-w-0 flex-col">
								<span className="text-[13px] text-text-1">
									Filter this table by <span className="font-mono">{pluginName}</span>
								</span>
								<span className="mt-px text-[11px] text-text-4">
									Show only skills bundled by this plugin
								</span>
							</span>
						</button>
						<a
							href={`/plugins?name=${encodeURIComponent(pluginName)}`}
							role="menuitem"
							onClick={handleOpenInPlugins}
							className="group flex w-full items-start gap-2.5 rounded-[5px] bg-transparent px-[9px] py-2 text-left text-[13px] text-text-1 no-underline hover:bg-surface-700"
						>
							<Plug
								size={14}
								aria-hidden
								className="mt-px shrink-0 text-text-3 transition-colors duration-100 group-hover:text-accent-bright"
							/>
							<span className="flex min-w-0 flex-col">
								<span className="text-[13px] text-text-1">
									Open <span className="font-mono">{pluginName}</span> in Plugins
								</span>
								<span className="mt-px text-[11px] text-text-4">
									Loaders, status, all bundled skills
								</span>
							</span>
							<ArrowUpRight
								size={12}
								aria-hidden
								className="ml-auto shrink-0 self-center text-text-4 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
							/>
						</a>
					</div>,
					document.body,
				)}
		</>
	);
}
