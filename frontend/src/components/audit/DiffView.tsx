import type { AuditDiffMetadata } from "@/types/api";

interface Props {
	diff: AuditDiffMetadata;
}

export function DiffView({ diff }: Props) {
	if (!diff.changedFields || diff.changedFields.length === 0) {
		return <p className="text-text-4 text-xs">No field changed.</p>;
	}
	return (
		<table className="w-full text-xs border border-edge-dim rounded">
			<thead className="bg-surface-800">
				<tr>
					<th className="text-left px-2 py-1 font-medium text-text-3">Field</th>
					<th className="text-left px-2 py-1 font-medium text-text-3">Before</th>
					<th className="text-left px-2 py-1 font-medium text-text-3">After</th>
				</tr>
			</thead>
			<tbody>
				{diff.changedFields.map((field) => (
					<tr key={field} className="border-t border-edge-dim">
						<td className="px-2 py-1 text-text-2 font-mono">{field}</td>
						<td className="px-2 py-1 text-text-3">
							<span className="bg-danger/10 text-danger px-1.5 rounded">
								{formatValue(diff.before[field])}
							</span>
						</td>
						<td className="px-2 py-1 text-text-3">
							<span className="bg-success/10 text-success px-1.5 rounded">
								{formatValue(diff.after[field])}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function formatValue(v: unknown): string {
	if (v === null || v === undefined) return "—";
	if (typeof v === "boolean") return v ? "true" : "false";
	if (typeof v === "string") return v;
	if (typeof v === "number") return String(v);
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}

export function isDiffMetadata(meta: unknown): meta is AuditDiffMetadata {
	if (!meta || typeof meta !== "object") return false;
	const m = meta as Record<string, unknown>;
	return (
		Array.isArray(m.changedFields) &&
		typeof m.before === "object" &&
		m.before !== null &&
		typeof m.after === "object" &&
		m.after !== null
	);
}
