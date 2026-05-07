import type { ParsedEvent } from "@/domain/event";

export type { ParsedEvent };

interface AnyValue {
	stringValue?: string;
	intValue?: number | string;
	doubleValue?: number;
	boolValue?: boolean;
	arrayValue?: { values?: AnyValue[] };
	kvlistValue?: { values?: Array<{ key: string; value: AnyValue }> };
}

interface KeyValue {
	key: string;
	value: AnyValue;
}

interface LogRecord {
	timeUnixNano?: string;
	observedTimeUnixNano?: string;
	attributes?: KeyValue[];
	body?: AnyValue;
}

interface ScopeLog {
	logRecords?: LogRecord[];
}

interface ResourceLog {
	resource?: { attributes?: KeyValue[] };
	scopeLogs?: ScopeLog[];
}

interface OtlpLogsBody {
	resourceLogs?: ResourceLog[];
}

function parseAnyValue(v: AnyValue): unknown {
	if (v.stringValue !== undefined) return v.stringValue;
	if (v.intValue !== undefined) return Number(v.intValue);
	if (v.doubleValue !== undefined) return v.doubleValue;
	if (v.boolValue !== undefined) return v.boolValue;
	if (v.arrayValue) return (v.arrayValue.values ?? []).map(parseAnyValue);
	if (v.kvlistValue) {
		const obj: Record<string, unknown> = {};
		for (const kv of v.kvlistValue.values ?? []) {
			obj[kv.key] = parseAnyValue(kv.value);
		}
		return obj;
	}
	return null;
}

function flattenAttributes(attrs: KeyValue[] | undefined): Record<string, unknown> {
	if (!attrs) return {};
	const result: Record<string, unknown> = {};
	for (const { key, value } of attrs) {
		result[key] = parseAnyValue(value);
	}
	return result;
}

function nanoStringToDate(nanoStr: string | undefined): Date | null {
	if (!nanoStr || nanoStr === "0") return null;
	try {
		const ms = BigInt(nanoStr) / 1_000_000n;
		return new Date(Number(ms));
	} catch {
		return null;
	}
}

export function parseOtlpBody(body: unknown): ParsedEvent[] {
	const data = body as OtlpLogsBody;
	if (!data?.resourceLogs) return [];

	const results: ParsedEvent[] = [];

	for (const resourceLog of data.resourceLogs) {
		const resourceAttrs = flattenAttributes(resourceLog.resource?.attributes);
		const userEmail = (resourceAttrs["user.email"] as string | undefined) ?? null;

		for (const scopeLog of resourceLog.scopeLogs ?? []) {
			for (const record of scopeLog.logRecords ?? []) {
				const timestamp =
					nanoStringToDate(record.timeUnixNano) ??
					nanoStringToDate(record.observedTimeUnixNano) ??
					new Date();

				const attrs = flattenAttributes(record.attributes);

				const shortName = (attrs["event.name"] as string | undefined) ?? "unknown";
				const eventName = shortName.startsWith("claude_code.")
					? shortName
					: `claude_code.${shortName}`;

				const sessionId =
					(attrs["session.id"] as string | undefined) ??
					(resourceAttrs["session.id"] as string | undefined) ??
					null;

				results.push({ userEmail, sessionId, eventName, timestamp, attributes: attrs });
			}
		}
	}

	return results;
}
