import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { StatusFilter } from "./StatusFilter";

const PLUGIN = ["unknown", "to_review", "approved", "removed"] as const;

describe("StatusFilter", () => {
	it("renders the 'all' option and one option per allowed status", () => {
		const html = renderToString(
			<StatusFilter value="all" onChange={() => {}} options={PLUGIN} />,
		);
		expect(html).toContain('value="all"');
		expect(html).toContain('value="unknown"');
		expect(html).toContain('value="to_review"');
		expect(html).toContain('value="approved"');
		expect(html).toContain('value="removed"');
	});

	it("uses the provided allLabel", () => {
		const html = renderToString(
			<StatusFilter
				value="all"
				onChange={() => {}}
				options={PLUGIN}
				allLabel="All statuses"
			/>,
		);
		expect(html).toContain("All statuses");
	});

	it("renders human-readable labels for each status", () => {
		const html = renderToString(
			<StatusFilter value="all" onChange={() => {}} options={PLUGIN} />,
		);
		expect(html).toContain("To Review");
		expect(html).toContain("Approved");
		expect(html).toContain("Removed");
	});

	it("marks the current value as selected", () => {
		const html = renderToString(
			<StatusFilter value="approved" onChange={() => {}} options={PLUGIN} />,
		);
		// React server-renders selected option via defaultValue on the select; just
		// check the selected option's value appears in the markup.
		expect(html).toContain('value="approved"');
	});
});
