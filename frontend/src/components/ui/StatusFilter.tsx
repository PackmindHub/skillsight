import { Select } from "./Select";
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
	className,
}: StatusFilterProps<S>) {
	return (
		<Select
			aria-label={ariaLabel}
			value={value}
			onChange={(e) => onChange(e.target.value as S | "all")}
			size="sm"
			className={className}
		>
			<option value="all">{allLabel}</option>
			{options.map((s) => (
				<option key={s} value={s}>
					{statusLabel(s)}
				</option>
			))}
		</Select>
	);
}
