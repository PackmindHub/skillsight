import { type AnyStatus, statusLabel } from "./StatusBadge";

interface StatusFilterProps<S extends AnyStatus> {
	value: S | "all";
	onChange: (next: S | "all") => void;
	options: readonly S[];
	allLabel?: string;
	ariaLabel?: string;
	className?: string;
}

export function StatusFilter<S extends AnyStatus>({
	value,
	onChange,
	options,
	allLabel = "Status: All",
	ariaLabel = "Filter by status",
	className = "",
}: StatusFilterProps<S>) {
	return (
		<select
			aria-label={ariaLabel}
			value={value}
			onChange={(e) => onChange(e.target.value as S | "all")}
			className={`rounded border border-edge bg-surface-800 px-3 py-1.5 text-sm text-text-1 focus:outline-none focus:ring-1 focus:ring-accent-bright ${className}`}
		>
			<option value="all">{allLabel}</option>
			{options.map((s) => (
				<option key={s} value={s}>
					{statusLabel(s)}
				</option>
			))}
		</select>
	);
}
