import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
	label?: ReactNode;
	htmlFor?: string;
	helper?: ReactNode;
	error?: ReactNode;
	required?: boolean;
	children: ReactNode;
	className?: string;
}

export function FormField({
	label,
	htmlFor,
	helper,
	error,
	required,
	children,
	className,
}: FormFieldProps) {
	return (
		<div className={cn("space-y-1", className)}>
			{label && (
				<label
					htmlFor={htmlFor}
					className="block text-sm font-medium text-text-2"
				>
					{label}
					{required && <span className="ml-0.5 text-danger">*</span>}
				</label>
			)}
			{children}
			{error ? (
				<p className="text-xs text-danger">{error}</p>
			) : helper ? (
				<p className="text-xs text-text-3">{helper}</p>
			) : null}
		</div>
	);
}
