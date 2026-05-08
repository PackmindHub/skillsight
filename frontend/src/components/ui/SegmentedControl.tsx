import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string | number> {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: string }[];
	ariaLabel?: string;
	className?: string;
}

export function SegmentedControl<T extends string | number>({
	value,
	onChange,
	options,
	ariaLabel,
	className,
}: SegmentedControlProps<T>) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn(
				"inline-flex items-center rounded-md border border-edge bg-surface-800 p-0.5 text-xs",
				className,
			)}
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<button
						type="button"
						role="tab"
						aria-selected={active}
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						className={cn(
							"px-2.5 py-1 rounded transition-colors",
							active
								? "bg-surface-600 text-text-1"
								: "text-text-3 hover:text-text-1 hover:bg-surface-700",
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
