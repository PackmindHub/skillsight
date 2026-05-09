import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
	it("renders title and subtitle", () => {
		const html = renderToString(<PageHeader title="Dashboard" subtitle="overview" />);
		expect(html).toContain("Dashboard");
		expect(html).toContain("overview");
	});

	it("renders actions slot", () => {
		const html = renderToString(
			<PageHeader title="X" actions={<button type="button">Add</button>} />,
		);
		expect(html).toContain("Add");
	});

	it("renders eyebrow above title", () => {
		const html = renderToString(<PageHeader title="X" eyebrow="Settings" />);
		expect(html).toContain("Settings");
		expect(html).toContain("uppercase");
	});
});
