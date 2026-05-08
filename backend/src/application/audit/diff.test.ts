import { describe, expect, it } from "bun:test";
import { buildDiff } from "./diff";

describe("buildDiff", () => {
	it("returns null when nothing changed in the watched fields", () => {
		const diff = buildDiff(
			{ name: "x", count: 1 },
			{ name: "x", count: 1 },
			["name", "count"] as const,
		);
		expect(diff).toBeNull();
	});

	it("captures only the fields that actually changed", () => {
		const diff = buildDiff(
			{ name: "x", count: 1, color: "red" },
			{ name: "x", count: 2, color: "red" },
			["name", "count", "color"] as const,
		);
		expect(diff?.changedFields).toEqual(["count"]);
		expect(diff?.before).toEqual({ count: 1 });
		expect(diff?.after).toEqual({ count: 2 });
	});

	it("treats null and undefined as equal to avoid noisy diffs", () => {
		const diff = buildDiff(
			{ value: null as null | undefined },
			{ value: undefined as null | undefined },
			["value"] as const,
		);
		expect(diff).toBeNull();
	});

	it("ignores fields outside the watched list even if they differ", () => {
		const diff = buildDiff(
			{ a: 1, b: 99 },
			{ a: 2, b: 100 },
			["a"] as const,
		);
		expect(diff?.changedFields).toEqual(["a"]);
	});
});
