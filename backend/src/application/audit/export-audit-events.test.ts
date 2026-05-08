import { describe, expect, it } from "bun:test";
import { exportAuditEventsCsv } from "./export-audit-events";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditEntry } from "@/domain/audit";

function makeAudit(rows: AuditEntry[]): IAuditRepository {
	return {
		log: async () => {},
		list: async () => ({ items: rows, total: rows.length }),
		listAll: async () => rows,
	};
}

describe("exportAuditEventsCsv", () => {
	it("emits a header even when there are no rows", async () => {
		const csv = await exportAuditEventsCsv({ audit: makeAudit([]) }, {});
		const lines = csv.trim().split("\n");
		expect(lines).toHaveLength(1);
		expect(lines[0]).toBe("id,timestamp,actor_email,action,target,metadata");
	});

	it("escapes quotes and commas in fields", async () => {
		const csv = await exportAuditEventsCsv(
			{
				audit: makeAudit([
					{
						id: 1,
						actorEmail: 'alice"@example.com',
						action: "marketplace_updated",
						target: "name, with comma",
						timestamp: new Date("2026-01-01T00:00:00Z"),
						metadata: { note: "value with \"quotes\"" },
					},
				]),
			},
			{},
		);
		const dataLine = csv.trim().split("\n")[1];
		expect(dataLine).toContain('"alice""@example.com"');
		expect(dataLine).toContain('"name, with comma"');
		expect(dataLine).toContain('"{""note"":""value with \\""quotes\\""""}"');
	});
});
