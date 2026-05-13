import { describe, expect, it } from "bun:test";
import { compareSemver, maxSemver } from "./semver";

describe("compareSemver", () => {
	it("orders by major then minor then patch", () => {
		expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
		expect(compareSemver("1.3.0", "1.2.99")).toBe(1);
		expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
		expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
	});

	it("treats no-prerelease as greater than any prerelease (1.0.0 > 1.0.0-alpha)", () => {
		expect(compareSemver("1.0.0", "1.0.0-alpha")).toBe(1);
		expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
		expect(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe(-1);
	});

	it("accepts an optional leading 'v'", () => {
		expect(compareSemver("v1.2.3", "1.2.4")).toBe(-1);
		expect(compareSemver("v2.0.0", "v1.0.0")).toBe(1);
	});

	it("treats unparseable strings as lower than parseable, with lexical fallback among unparseables", () => {
		expect(compareSemver("not-a-version", "1.0.0")).toBe(-1);
		expect(compareSemver("1.0.0", "not-a-version")).toBe(1);
		expect(compareSemver("alpha", "beta")).toBe(-1);
	});

	it("ignores build metadata for ordering", () => {
		expect(compareSemver("1.2.3+build.1", "1.2.3+build.2")).toBe(0);
	});
});

describe("maxSemver", () => {
	it("returns null for an empty input", () => {
		expect(maxSemver([])).toBeNull();
	});

	it("picks the highest parseable version", () => {
		expect(maxSemver(["1.0.0", "2.0.0", "1.5.0"])).toBe("2.0.0");
	});

	it("prefers a parseable version over unparseable junk", () => {
		expect(maxSemver(["1.0.0", "broken", "2.0.0"])).toBe("2.0.0");
	});

	it("falls back to lexical max among unparseable strings", () => {
		expect(maxSemver(["alpha", "beta", "gamma"])).toBe("gamma");
	});

	it("prefers release over prerelease at the same triple", () => {
		expect(maxSemver(["1.0.0-rc.1", "1.0.0", "1.0.0-rc.2"])).toBe("1.0.0");
	});
});
