import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { StatusBadge, statusLabel } from "./StatusBadge";

describe("StatusBadge", () => {
	it("renders the label for each known status", () => {
		expect(renderToString(<StatusBadge status="to_review" />)).toContain("To Review");
		expect(renderToString(<StatusBadge status="approved" />)).toContain("Approved");
		expect(renderToString(<StatusBadge status="removed" />)).toContain("Removed");
		expect(renderToString(<StatusBadge status="denied" />)).toContain("Denied");
	});

	it("applies a status-specific class", () => {
		const html = renderToString(<StatusBadge status="approved" />);
		expect(html).toContain("emerald");
	});
});

describe("statusLabel", () => {
	it("returns the human-readable label", () => {
		expect(statusLabel("to_review")).toBe("To Review");
		expect(statusLabel("approved")).toBe("Approved");
	});
});
