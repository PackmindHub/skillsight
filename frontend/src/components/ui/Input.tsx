import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { INPUT_BASE, INPUT_INVALID, INPUT_SIZE, type InputSize } from "./_styles";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	invalid?: boolean;
	size?: InputSize;
	leftSlot?: ReactNode;
	rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ invalid, size = "md", leftSlot, rightSlot, className, ...rest },
	ref,
) {
	const inputClasses = cn(
		INPUT_BASE,
		"w-full",
		INPUT_SIZE[size],
		leftSlot && "pl-9",
		rightSlot && "pr-9",
		invalid && INPUT_INVALID,
		className,
	);

	if (!leftSlot && !rightSlot) {
		return <input ref={ref} className={inputClasses} {...rest} />;
	}

	return (
		<div className="relative">
			{leftSlot && (
				<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-4">
					{leftSlot}
				</span>
			)}
			<input ref={ref} className={inputClasses} {...rest} />
			{rightSlot && (
				<span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-text-4">
					{rightSlot}
				</span>
			)}
		</div>
	);
});
