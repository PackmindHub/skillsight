import { Button, Card, Input } from "@/components/ui";
import type { AuditFilters as Filters } from "@/types/api";
import { useState } from "react";

interface Props {
	value: Filters;
	availableActions: string[];
	onChange: (next: Filters) => void;
	onReset: () => void;
	onExport: () => void;
}

export function AuditFiltersBar({ value, availableActions, onChange, onReset, onExport }: Props) {
	const [open, setOpen] = useState(false);
	const selectedActions = new Set(value.actions ?? []);
	const activeCount = countActive(value);

	const toggleAction = (action: string) => {
		const next = new Set(selectedActions);
		if (next.has(action)) next.delete(action);
		else next.add(action);
		onChange({ ...value, actions: next.size > 0 ? Array.from(next) : undefined });
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 flex-wrap">
				<Input
					size="sm"
					value={value.search ?? ""}
					onChange={(e) =>
						onChange({ ...value, search: e.target.value.length > 0 ? e.target.value : undefined })
					}
					placeholder="Search target / metadata…"
					className="w-64"
				/>
				<Input
					size="sm"
					value={value.actor ?? ""}
					onChange={(e) =>
						onChange({ ...value, actor: e.target.value.length > 0 ? e.target.value : undefined })
					}
					placeholder="Actor email"
					className="w-56"
				/>
				<Input
					size="sm"
					type="datetime-local"
					value={value.from ? toLocal(value.from) : ""}
					onChange={(e) => onChange({ ...value, from: fromLocal(e.target.value) })}
					className="w-44"
				/>
				<span className="text-text-4 text-xs">to</span>
				<Input
					size="sm"
					type="datetime-local"
					value={value.to ? toLocal(value.to) : ""}
					onChange={(e) => onChange({ ...value, to: fromLocal(e.target.value) })}
					className="w-44"
				/>
				<Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
					Actions{selectedActions.size > 0 ? ` (${selectedActions.size})` : ""}
				</Button>
				<div className="flex-1" />
				{activeCount > 0 && (
					<Button variant="ghost" size="sm" onClick={onReset}>
						Reset
					</Button>
				)}
				<Button variant="secondary" size="sm" onClick={onExport}>
					Export CSV
				</Button>
			</div>

			{open && (
				<Card padding="sm">
					<div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
						{availableActions.map((action) => {
							const checked = selectedActions.has(action);
							return (
								<label
									key={action}
									className="flex items-center gap-2 text-xs text-text-2 cursor-pointer"
								>
									<input
										type="checkbox"
										checked={checked}
										onChange={() => toggleAction(action)}
									/>
									<span className="font-mono">{action}</span>
								</label>
							);
						})}
					</div>
				</Card>
			)}
		</div>
	);
}

function countActive(f: Filters): number {
	let n = 0;
	if (f.search) n++;
	if (f.actor) n++;
	if (f.target) n++;
	if (f.from) n++;
	if (f.to) n++;
	if (f.actions && f.actions.length > 0) n++;
	return n;
}

function toLocal(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocal(local: string): string | undefined {
	if (!local) return undefined;
	const d = new Date(local);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toISOString();
}
