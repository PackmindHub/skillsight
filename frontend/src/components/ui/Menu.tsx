import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DROPDOWN_PANEL, MENU_ITEM_BASE } from "./_styles";

type MenuVariant = "default" | "warning" | "danger";

interface MenuContextValue {
	close: () => void;
	open: boolean;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
	const ctx = useContext(MenuContext);
	if (!ctx) throw new Error("Menu primitives must be used inside <Menu>");
	return ctx;
}

interface MenuProps {
	trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
	children: ReactNode;
	align?: "left" | "right";
}

export function Menu({ trigger, children, align = "right" }: MenuProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

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

	const close = () => setOpen(false);
	const toggle = () => setOpen((o) => !o);

	return (
		<MenuContext.Provider value={{ close, open }}>
			<div ref={containerRef} className="relative inline-block">
				{trigger({ open, toggle })}
				{open && (
					<div
						role="menu"
						className={cn(DROPDOWN_PANEL, "min-w-[200px]", align === "right" ? "right-0" : "left-0")}
					>
						{children}
					</div>
				)}
			</div>
		</MenuContext.Provider>
	);
}

interface MenuItemProps {
	onClick?: () => void;
	disabled?: boolean;
	variant?: MenuVariant;
	children: ReactNode;
	closeOnClick?: boolean;
}

const variantClass: Record<MenuVariant, string> = {
	default: "text-text-2 hover:text-text-1",
	warning: "text-warning hover:text-warning",
	danger: "text-danger hover:text-danger",
};

export function MenuItem({ onClick, disabled, variant = "default", children, closeOnClick = true }: MenuItemProps) {
	const { close } = useMenuContext();
	return (
		<button
			type="button"
			role="menuitem"
			disabled={disabled}
			onClick={() => {
				onClick?.();
				if (closeOnClick) close();
			}}
			className={cn(MENU_ITEM_BASE, variantClass[variant])}
		>
			{children}
		</button>
	);
}

export function MenuDivider() {
	return <div aria-hidden="true" className="my-1 border-t border-edge-dim" />;
}

export function useMenuClose() {
	return useMenuContext().close;
}
