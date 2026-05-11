import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { StatusFilter } from "./StatusFilter";

const PLUGIN = ["to_review", "approved", "removed"] as const;

describe("StatusFilter", () => {
	it("renders the trigger button with the 'Status:' prefix and current label", () => {
		const html = renderToString(
			<StatusFilter value="all" onChange={() => {}} options={PLUGIN} />,
		);
		expect(html).toContain("Status:");
		expect(html).toContain("All");
	});

	it("uses the provided allLabel for the 'all' state", () => {
		const html = renderToString(
			<StatusFilter
				value="all"
				onChange={() => {}}
				options={PLUGIN}
				allLabel="Any status"
			/>,
		);
		expect(html).toContain("Any status");
	});

	it("renders the current status label when a specific status is selected", () => {
		const html = renderToString(
			<StatusFilter value="approved" onChange={() => {}} options={PLUGIN} />,
		);
		expect(html).toContain("Approved");
	});

	it("exposes the aria-label on the trigger", () => {
		const html = renderToString(
			<StatusFilter value="all" onChange={() => {}} options={PLUGIN} />,
		);
		expect(html).toContain('aria-label="Filter by status"');
	});
});
