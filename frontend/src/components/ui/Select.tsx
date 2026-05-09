import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { INPUT_BASE, INPUT_INVALID, INPUT_SIZE, type InputSize } from "./_styles";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
	invalid?: boolean;
	size?: InputSize;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
	{ invalid, size = "md", className, children, ...rest },
	ref,
) {
	return (
		<select
			ref={ref}
			className={cn(
				INPUT_BASE,
				INPUT_SIZE[size],
				"pr-8",
				invalid && INPUT_INVALID,
				className,
			)}
			{...rest}
		>
			{children}
		</select>
	);
});
