import { describe, expect, it } from "bun:test";
import {
	cn,
	computeDeltaPct,
	formatDate,
	formatDateTime,
	formatRelativeShort,
	isCurrentUtcMonth,
	repoSlugFromGitUrl,
	sumKnownTriggers,
} from "./utils";

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

describe("computeDeltaPct", () => {
	it("returns 0 for series shorter than 4 (after trim)", () => {
		expect(computeDeltaPct([])).toBe(0);
		expect(computeDeltaPct([1, 2, 3])).toBe(0);
		// length 5 trims to 4, still computes
		expect(computeDeltaPct([10, 10, 10, 10, 10])).toBe(0);
	});

	it("compares equal-size halves for even-length series", () => {
		// first half = 10, second half = 20 → +100%
		expect(computeDeltaPct([5, 5, 10, 10])).toBe(100);
		// first half = 20, second half = 10 → -50%
		expect(computeDeltaPct([10, 10, 5, 5])).toBe(-50);
		// flat
		expect(computeDeltaPct([5, 5, 5, 5])).toBe(0);
	});

	it("trims an odd-length series from the front (keeps today)", () => {
		// 7 elements: [1, 1, 1, 1, 1, 1, 1] → trim to last 6 → 3 vs 3 → flat
		expect(computeDeltaPct([1, 1, 1, 1, 1, 1, 1])).toBe(0);

		// 7 elements: dropping the oldest preserves recent activity. With the
		// PREVIOUS buggy split this would have been [0,0,0] vs [1,1,1,1] = +∞,
		// but trimming from the front gives [0,0,1] vs [1,1,1] = +200%.
		expect(computeDeltaPct([0, 0, 0, 1, 1, 1, 1])).toBe(200);
	});

	it("treats a zero first half as +100% when there is any growth", () => {
		expect(computeDeltaPct([0, 0, 1, 1])).toBe(100);
		expect(computeDeltaPct([0, 0, 0, 0])).toBe(0);
	});

	it("rounds to an integer", () => {
		// first = 3, second = 4 → 33.3% → 33
		expect(computeDeltaPct([1, 2, 2, 2])).toBe(33);
	});
});

describe("isCurrentUtcMonth", () => {
	it("matches the current UTC month", () => {
		const now = new Date(Date.UTC(2026, 4, 13)); // 2026-05-13
		expect(isCurrentUtcMonth("2026-05-01", now)).toBe(true);
		// any day-string within the month also matches because we slice to YYYY-MM
		expect(isCurrentUtcMonth("2026-05-31", now)).toBe(true);
	});

	it("does not match a prior or future month", () => {
		const now = new Date(Date.UTC(2026, 4, 13));
		expect(isCurrentUtcMonth("2026-04-01", now)).toBe(false);
		expect(isCurrentUtcMonth("2026-06-01", now)).toBe(false);
		expect(isCurrentUtcMonth("2025-05-01", now)).toBe(false);
	});

	it("zero-pads single-digit months when comparing", () => {
		const now = new Date(Date.UTC(2026, 0, 5)); // January
		expect(isCurrentUtcMonth("2026-01-01", now)).toBe(true);
		expect(isCurrentUtcMonth("2026-11-01", now)).toBe(false);
	});
});

describe("formatRelativeShort", () => {
	const now = new Date("2026-05-13T12:00:00.000Z");

	it("returns 'just now' under a minute", () => {
		expect(formatRelativeShort("2026-05-13T11:59:30.000Z", now)).toBe("just now");
	});

	it("formats minutes / hours / days / months compactly", () => {
		expect(formatRelativeShort("2026-05-13T11:55:00.000Z", now)).toBe("5m ago");
		expect(formatRelativeShort("2026-05-13T09:00:00.000Z", now)).toBe("3h ago");
		expect(formatRelativeShort("2026-05-10T12:00:00.000Z", now)).toBe("3d ago");
		expect(formatRelativeShort("2026-02-13T12:00:00.000Z", now)).toBe("3mo ago");
	});
});

describe("repoSlugFromGitUrl", () => {
	it("strips https origins", () => {
		expect(repoSlugFromGitUrl("https://github.com/anthropics/skills")).toBe("anthropics/skills");
		expect(repoSlugFromGitUrl("https://github.com/anthropics/skills.git")).toBe(
			"anthropics/skills",
		);
	});

	it("strips git@ ssh form", () => {
		expect(repoSlugFromGitUrl("git@github.com:anthropics/skills.git")).toBe("anthropics/skills");
	});

	it("returns the input untouched when no prefix matches", () => {
		expect(repoSlugFromGitUrl("owner/repo")).toBe("owner/repo");
	});
});

describe("sumKnownTriggers", () => {
	it("returns zeros for an empty list", () => {
		expect(sumKnownTriggers([])).toEqual({ user: 0, claude: 0, nested: 0 });
	});

	it("buckets each known trigger by name", () => {
		expect(
			sumKnownTriggers([
				{ trigger: "user-slash", count: 7 },
				{ trigger: "claude-proactive", count: 11 },
				{ trigger: "nested-skill", count: 3 },
			]),
		).toEqual({ user: 7, claude: 11, nested: 3 });
	});

	it("ignores unknown triggers and null entries", () => {
		const totals = sumKnownTriggers([
			{ trigger: "user-slash", count: 4 },
			{ trigger: null, count: 5 },
			{ trigger: "something-new", count: 6 },
		]);
		expect(totals).toEqual({ user: 4, claude: 0, nested: 0 });
	});

	it("sums repeated entries for the same trigger", () => {
		const totals = sumKnownTriggers([
			{ trigger: "user-slash", count: 1 },
			{ trigger: "user-slash", count: 2 },
		]);
		expect(totals.user).toBe(3);
	});
});
