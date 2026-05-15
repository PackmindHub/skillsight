import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { HelpTip } from "./HelpTip";

describe("HelpTip", () => {
	it("renders the trigger with a ? glyph and accessible label", () => {
		const html = renderToString(<HelpTip title="Adopted" body="Plugins loaded by at least one user." />);
		expect(html).toContain("?");
		expect(html).toContain('aria-label="What is Adopted?"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain("rounded-full");
	});

	it("falls back to a generic aria label when title is omitted", () => {
		const html = renderToString(<HelpTip body="some explanation" />);
		expect(html).toContain('aria-label="More information"');
	});

	it("does not render the popover until interaction (SSR snapshot)", () => {
		const html = renderToString(<HelpTip title="x" body="y" hint="Click to filter" />);
		expect(html).not.toContain("Click to filter");
		expect(html).not.toContain("role=\"tooltip\"");
	});
});
