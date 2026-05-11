import type { ParsedEvent } from "@/domain/event";
import type { LokiStreamResult, LokiStreamValue } from "@/domain/ports/loki-gateway";
import { parseOtlpBody } from "./otlp-parser";

// Loki's native OTLP receiver flattens attribute keys with `.` to `_`. To keep
// downstream code (sync-integration, preview-integration) able to read keys like
// `skill.name`, we also expose dotted aliases for any underscored key.
function withDottedAliases(obj: Record<string, string>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		out[k] = v;
		if (k.includes("_")) out[k.replace(/_/g, ".")] = v;
	}
	return out;
}

function nsToDate(tsNs: string): Date {
	try {
		return new Date(Number(BigInt(tsNs) / 1_000_000n));
	} catch {
		return new Date();
	}
}

function eventFromBodyAndMetadata(
	streamLabels: Record<string, string>,
	value: LokiStreamValue,
): ParsedEvent {
	const [tsNs, line, structuredMetadata] = value;
	const metadata = structuredMetadata ?? {};

	const attributes = {
		...withDottedAliases(streamLabels),
		...withDottedAliases(metadata),
	};

	const bodyName = line.trim();
	const metadataName =
		typeof metadata.event_name === "string" ? metadata.event_name : null;
	const shortName = bodyName || metadataName || "unknown";
	const eventName = shortName.startsWith("claude_code.")
		? shortName
		: `claude_code.${shortName}`;

	const userEmail = (attributes["user.email"] as string | undefined) ?? null;
	const sessionId = (attributes["session.id"] as string | undefined) ?? null;

	return {
		userEmail,
		sessionId,
		eventName,
		timestamp: nsToDate(tsNs),
		attributes,
	};
}

/**
 * Extract ParsedEvents from a Loki query_range response.
 *
 * Supports two shapes:
 *   1. Log line is a full OTLP JSON envelope (`{resourceLogs: [...]}`). Used by
 *      pipelines that forward raw OTLP payloads as the log line body.
 *   2. Log line is the event name string, with log-record attributes carried as
 *      structured metadata on the value tuple (third element). This is the
 *      shape Loki's native OTLP receiver produces.
 */
export function parseLokiStreams(streams: LokiStreamResult[]): ParsedEvent[] {
	const results: ParsedEvent[] = [];

	for (const { stream, values } of streams) {
		for (const value of values) {
			const [, line] = value;

			let parsed: ParsedEvent[] = [];
			try {
				const json = JSON.parse(line) as Record<string, unknown>;
				if (json?.resourceLogs) parsed = parseOtlpBody(json);
			} catch {
				// not JSON or not OTLP — fall through to body+metadata path
			}

			if (parsed.length > 0) {
				results.push(...parsed);
			} else {
				results.push(eventFromBodyAndMetadata(stream, value));
			}
		}
	}

	return results;
}
