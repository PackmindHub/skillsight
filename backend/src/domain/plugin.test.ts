import { describe, expect, it } from "bun:test";
import { normalizeMarketplaceName } from "./plugin";

describe("normalizeMarketplaceName", () => {
	it("returns null for the 'inline' sentinel (locally-installed plugins)", () => {
		expect(normalizeMarketplaceName("inline")).toBeNull();
	});

	it("returns null for null/undefined/empty inputs", () => {
		expect(normalizeMarketplaceName(null)).toBeNull();
		expect(normalizeMarketplaceName(undefined)).toBeNull();
		expect(normalizeMarketplaceName("")).toBeNull();
	});

	it("passes real marketplace names through unchanged", () => {
		expect(normalizeMarketplaceName("anthropic-official")).toBe("anthropic-official");
		expect(normalizeMarketplaceName("my-internal")).toBe("my-internal");
	});

	it("does not match case-insensitive variants — only the literal 'inline'", () => {
		expect(normalizeMarketplaceName("Inline")).toBe("Inline");
		expect(normalizeMarketplaceName("INLINE")).toBe("INLINE");
	});
});
