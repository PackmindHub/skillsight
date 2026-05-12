import { describe, expect, it } from "bun:test";
import { parseTimeWindow } from "./usage";

describe("parseTimeWindow", () => {
	it("defaults to a 30-day preset when no params are given", () => {
		expect(parseTimeWindow({})).toEqual({ kind: "preset", days: 30 });
	});

	it("parses a numeric days preset", () => {
		expect(parseTimeWindow({ days: "7" })).toEqual({ kind: "preset", days: 7 });
		expect(parseTimeWindow({ days: "90" })).toEqual({ kind: "preset", days: 90 });
	});

	it("parses the all preset", () => {
		expect(parseTimeWindow({ days: "all" })).toEqual({ kind: "preset", days: "all" });
	});

	it("clamps numeric days to [1, 365]", () => {
		expect(parseTimeWindow({ days: "0" })).toEqual({ kind: "preset", days: 1 });
		expect(parseTimeWindow({ days: "-5" })).toEqual({ kind: "preset", days: 1 });
		expect(parseTimeWindow({ days: "9999" })).toEqual({ kind: "preset", days: 365 });
	});

	it("rejects non-numeric days", () => {
		const result = parseTimeWindow({ days: "foo" });
		expect("error" in result).toBe(true);
	});

	it("parses a valid date range with exclusive upper bound", () => {
		const result = parseTimeWindow({ from: "2026-04-01", to: "2026-04-10" });
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.kind).toBe("range");
		expect(result.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
		// `to` is exclusive: the day after 2026-04-10.
		expect(result.to.toISOString()).toBe("2026-04-11T00:00:00.000Z");
	});

	it("accepts a same-day range (single day)", () => {
		const result = parseTimeWindow({ from: "2026-04-05", to: "2026-04-05" });
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.from.toISOString()).toBe("2026-04-05T00:00:00.000Z");
		expect(result.to.toISOString()).toBe("2026-04-06T00:00:00.000Z");
	});

	it("rejects from > to", () => {
		const result = parseTimeWindow({ from: "2026-04-10", to: "2026-04-01" });
		expect("error" in result).toBe(true);
	});

	it("rejects a range longer than 365 days", () => {
		const result = parseTimeWindow({ from: "2024-01-01", to: "2026-04-01" });
		expect("error" in result).toBe(true);
	});

	it("rejects malformed dates", () => {
		expect("error" in parseTimeWindow({ from: "not-a-date", to: "2026-04-10" })).toBe(true);
		expect("error" in parseTimeWindow({ from: "2026-04-01", to: "bad" })).toBe(true);
		expect("error" in parseTimeWindow({ from: "2026-4-1", to: "2026-04-10" })).toBe(true);
	});

	it("rejects partial range (only from, or only to)", () => {
		expect("error" in parseTimeWindow({ from: "2026-04-01" })).toBe(true);
		expect("error" in parseTimeWindow({ to: "2026-04-10" })).toBe(true);
	});

	it("prefers the range when both range and days are provided", () => {
		const result = parseTimeWindow({ days: "7", from: "2026-04-01", to: "2026-04-10" });
		if ("error" in result) throw new Error("unexpected error");
		expect(result.kind).toBe("range");
	});
});
