import { describe, expect, it } from "bun:test";
import { EVENT_NAMES, SHORT_EVENT_NAMES } from "@/domain/event";
import { parseOtlpBody } from "./otlp-parser";

describe("parseOtlpBody", () => {
	it("returns empty array for empty input", () => {
		expect(parseOtlpBody({})).toEqual([]);
		expect(parseOtlpBody(null)).toEqual([]);
	});

	it("parses a minimal log record", () => {
		const body = {
			resourceLogs: [
				{
					resource: {
						attributes: [{ key: "user.email", value: { stringValue: "alice@example.com" } }],
					},
					scopeLogs: [
						{
							logRecords: [
								{
									timeUnixNano: "1700000000000000000",
									attributes: [
										{
											key: "event.name",
											value: { stringValue: SHORT_EVENT_NAMES.SKILL_ACTIVATED },
										},
									],
								},
							],
						},
					],
				},
			],
		};

		const [event] = parseOtlpBody(body);
		expect(event.userEmail).toBe("alice@example.com");
		expect(event.eventName).toBe(EVENT_NAMES.SKILL_ACTIVATED);
		expect(event.timestamp).toBeInstanceOf(Date);
	});

	it("prefixes event.name that already starts with claude_code.", () => {
		const body = {
			resourceLogs: [
				{
					scopeLogs: [
						{
							logRecords: [
								{
									attributes: [
										{ key: "event.name", value: { stringValue: "claude_code.tool_use" } },
									],
								},
							],
						},
					],
				},
			],
		};

		const [event] = parseOtlpBody(body);
		expect(event.eventName).toBe("claude_code.tool_use");
	});

	it("reads user.email from record attributes when missing from resource", () => {
		const body = {
			resourceLogs: [
				{
					scopeLogs: [
						{
							logRecords: [
								{
									attributes: [
										{ key: "user.email", value: { stringValue: "bob@example.com" } },
										{
											key: "event.name",
											value: { stringValue: SHORT_EVENT_NAMES.SKILL_ACTIVATED },
										},
									],
								},
							],
						},
					],
				},
			],
		};

		const [event] = parseOtlpBody(body);
		expect(event.userEmail).toBe("bob@example.com");
	});

	it("falls back to 'unknown' event name when attribute is missing", () => {
		const body = {
			resourceLogs: [{ scopeLogs: [{ logRecords: [{}] }] }],
		};

		const [event] = parseOtlpBody(body);
		expect(event.eventName).toBe("claude_code.unknown");
	});
});
