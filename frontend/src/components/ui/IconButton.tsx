import {
	type ButtonHTMLAttributes,
	type ReactNode,
	forwardRef,
} from "react";
import { cn } from "@/lib/utils";

export type IconButtonVariant = "ghost" | "primary" | "danger" | "success";
export type IconButtonSize = "sm" | "xs";

interface IconButtonProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	variant?: IconButtonVariant;
	size?: IconButtonSize;
	loading?: boolean;
	icon: ReactNode;
	"aria-label": string;
}

// Icon-only buttons render as a square. Variants use the same color tokens as
// Button, but as subtle tinted backgrounds — the gradient styles (btn-primary,
// btn-success) are reserved for h-9/h-8 text CTAs where the prominence reads.
const VARIANT: Record<IconButtonVariant, string> = {
	ghost:
		"text-text-3 border border-transparent hover:border-edge hover:bg-surface-700 hover:text-text-1",
	primary:
		"text-accent-bright border border-accent-bright/30 bg-accent-bright/10 hover:bg-accent-bright/20",
	danger:
		"text-text-3 border border-transparent hover:border-danger/35 hover:bg-surface-700 hover:text-danger",
	success:
		"text-success border border-success/30 bg-success/10 hover:bg-success/20",
};

const SIZE: Record<IconButtonSize, string> = {
	sm: "h-8 w-8",
	xs: "h-7 w-7",
};

const BASE =
	"inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright disabled:cursor-not-allowed disabled:opacity-60";

function Spinner({ size }: { size: IconButtonSize }) {
	const dim = size === "xs" ? 12 : 14;
	return (
		<svg
			className="animate-spin"
			width={dim}
			height={dim}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
			<path
				d="M14 8a6 6 0 0 0-6-6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	function IconButton(
		{
			variant = "ghost",
			size = "sm",
			loading = false,
			icon,
			disabled,
			className,
			type,
			...rest
		},
		ref,
	) {
		return (
			<button
				ref={ref}
				type={type ?? "button"}
				disabled={disabled || loading}
				className={cn(BASE, VARIANT[variant], SIZE[size], className)}
				{...rest}
			>
				{loading ? <Spinner size={size} /> : icon}
			</button>
		);
	},
);
