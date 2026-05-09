import {
	type ButtonHTMLAttributes,
	type ReactElement,
	type ReactNode,
	cloneElement,
	forwardRef,
	isValidElement,
} from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	fullWidth?: boolean;
	asChild?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
	primary: "btn-primary text-white",
	secondary:
		"bg-surface-700 hover:bg-surface-600 border border-edge text-text-1 disabled:opacity-40 disabled:cursor-not-allowed",
	ghost:
		"text-text-2 hover:bg-surface-700 hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed",
	danger:
		"bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-40 disabled:cursor-not-allowed",
};

const SIZE: Record<ButtonSize, string> = {
	sm: "h-8 px-3 text-sm gap-1.5",
	md: "h-9 px-4 text-sm gap-2",
};

const BASE =
	"inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright";

function Spinner({ size }: { size: ButtonSize }) {
	const dim = size === "sm" ? 12 : 14;
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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = "primary",
		size = "md",
		loading = false,
		leftIcon,
		rightIcon,
		fullWidth = false,
		asChild = false,
		disabled,
		className,
		children,
		type,
		...rest
	},
	ref,
) {
	const classes = cn(
		BASE,
		VARIANT[variant],
		SIZE[size],
		fullWidth && "w-full",
		className,
	);

	const content = (
		<>
			{loading ? <Spinner size={size} /> : leftIcon}
			{children}
			{!loading && rightIcon}
		</>
	);

	if (asChild) {
		if (!isValidElement(children)) {
			throw new Error("Button asChild requires a single React element child");
		}
		const child = children as ReactElement<{ className?: string }>;
		return cloneElement(child, {
			className: cn(classes, child.props.className),
			...rest,
		});
	}

	return (
		<button
			ref={ref}
			type={type ?? "button"}
			disabled={disabled || loading}
			className={classes}
			{...rest}
		>
			{content}
		</button>
	);
});
