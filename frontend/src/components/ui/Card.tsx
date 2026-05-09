import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardPadding = "none" | "sm" | "md" | "lg";
type CardSurface = "raised" | "sunken";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	padding?: CardPadding;
	surface?: CardSurface;
	interactive?: boolean;
}

const PADDING: Record<CardPadding, string> = {
	none: "",
	sm: "p-3",
	md: "p-4",
	lg: "p-6",
};

const SURFACE: Record<CardSurface, string> = {
	raised: "bg-surface-700 shadow-2xl shadow-black/60",
	sunken: "bg-surface-900",
};

export function Card({
	padding = "md",
	surface = "sunken",
	interactive = false,
	className,
	children,
	...rest
}: CardProps) {
	return (
		<div
			className={cn(
				"rounded-lg border border-edge",
				SURFACE[surface],
				PADDING[padding],
				interactive && "transition-colors hover:border-accent-bright/40 cursor-pointer",
				className,
			)}
			{...rest}
		>
			{children}
		</div>
	);
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("mb-3 flex items-start justify-between gap-3", className)} {...rest}>
			{children}
		</div>
	);
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("space-y-2", className)} {...rest}>
			{children}
		</div>
	);
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("mt-3 flex items-center justify-end gap-2 pt-3 border-t border-edge-dim", className)}
			{...rest}
		>
			{children}
		</div>
	);
}
