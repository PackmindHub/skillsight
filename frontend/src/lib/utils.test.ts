import { describe, expect, it } from "bun:test";
import { cn, formatDate, formatDateTime } from "./utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("a", "b")).toBe("a b");
	});

	it("resolves tailwind conflicts", () => {
		expect(cn("p-2", "p-4")).toBe("p-4");
	});

	it("ignores falsy values", () => {
		expect(cn("a", false, undefined, "b")).toBe("a b");
	});
});

describe("formatDate", () => {
	it("returns a non-empty string for a valid ISO date", () => {
		expect(formatDate("2024-01-15T10:00:00.000Z")).toBeTruthy();
	});
});

describe("formatDateTime", () => {
	it("returns a non-empty string for a valid ISO date", () => {
		expect(formatDateTime("2024-01-15T10:00:00.000Z")).toBeTruthy();
	});
});
