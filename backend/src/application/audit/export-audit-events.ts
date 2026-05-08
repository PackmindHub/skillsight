import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditFilters } from "@/domain/audit";

const MAX_EXPORT = 50000;

const HEADER = ["id", "timestamp", "actor_email", "action", "target", "metadata"];

export async function exportAuditEventsCsv(
	deps: { audit: IAuditRepository },
	filters: AuditFilters,
): Promise<string> {
	const rows = await deps.audit.listAll(filters, MAX_EXPORT);
	const lines: string[] = [HEADER.join(",")];
	for (const row of rows) {
		lines.push(
			[
				String(row.id),
				row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
				csvField(row.actorEmail ?? ""),
				csvField(row.action),
				csvField(row.target ?? ""),
				csvField(row.metadata ? JSON.stringify(row.metadata) : ""),
			].join(","),
		);
	}
	return `${lines.join("\n")}\n`;
}

function csvField(value: string): string {
	if (value === "") return "";
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}
