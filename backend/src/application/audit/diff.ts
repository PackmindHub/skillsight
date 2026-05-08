import type { AuditDiffMetadata } from "@/domain/audit";

export function buildDiff<T extends object>(
	before: T,
	after: T,
	fields: readonly (keyof T)[],
): AuditDiffMetadata | null {
	const changedFields: string[] = [];
	const diffBefore: Record<string, unknown> = {};
	const diffAfter: Record<string, unknown> = {};

	for (const field of fields) {
		const a = (before as Record<string, unknown>)[field as string];
		const b = (after as Record<string, unknown>)[field as string];
		if (!shallowEqual(a, b)) {
			changedFields.push(String(field));
			diffBefore[String(field)] = a ?? null;
			diffAfter[String(field)] = b ?? null;
		}
	}

	if (changedFields.length === 0) return null;
	return { before: diffBefore, after: diffAfter, changedFields };
}

function shallowEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a == null && b == null;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (typeof a !== "object" || typeof b !== "object") return false;
	const ao = a as Record<string, unknown>;
	const bo = b as Record<string, unknown>;
	const ak = Object.keys(ao);
	const bk = Object.keys(bo);
	if (ak.length !== bk.length) return false;
	return ak.every((k) => ao[k] === bo[k]);
}
