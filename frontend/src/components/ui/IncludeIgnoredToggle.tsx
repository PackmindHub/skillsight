import { cn } from "@/lib/utils";

interface IncludeIgnoredToggleProps {
	value: boolean;
	onChange: (next: boolean) => void;
	className?: string;
}

export function IncludeIgnoredToggle({ value, onChange, className }: IncludeIgnoredToggleProps) {
	return (
		<button
			type="button"
			aria-pressed={value}
			onClick={() => onChange(!value)}
			className={cn(
				"inline-flex h-8 items-center gap-2 rounded-md border border-edge bg-surface-800 px-3 text-sm text-text-1 hover:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-accent-bright",
				value && "border-accent-bright/40 bg-accent-bright/5",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
					value ? "border-accent-bright bg-accent-bright/20" : "border-edge bg-surface-900",
				)}
			>
				{value && (
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
						<path
							d="M2 5l2 2 4-4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</span>
			<span>Include ignored</span>
		</button>
	);
}
