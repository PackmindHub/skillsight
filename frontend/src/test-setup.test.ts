import { describe, expect, it } from "bun:test";

describe("test environment", () => {
	it("has a happy-dom document available", () => {
		const el = document.createElement("div");
		el.textContent = "hello";
		expect(el.textContent).toBe("hello");
	});
});
