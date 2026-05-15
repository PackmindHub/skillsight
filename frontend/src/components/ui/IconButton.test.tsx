import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { IconButton } from "./IconButton";

const Glyph = () => (
	<svg aria-hidden="true" data-test="glyph">
		<title>glyph</title>
	</svg>
);

describe("IconButton", () => {
	it("renders the icon and a square sm size by default", () => {
		const html = renderToString(<IconButton aria-label="Sync" icon={<Glyph />} />);
		expect(html).toContain("data-test=\"glyph\"");
		expect(html).toContain("h-8");
		expect(html).toContain("w-8");
	});

	it("applies the xs size", () => {
		const html = renderToString(<IconButton size="xs" aria-label="Edit" icon={<Glyph />} />);
		expect(html).toContain("h-7");
		expect(html).toContain("w-7");
	});

	it("applies variant classes", () => {
		expect(
			renderToString(<IconButton variant="danger" aria-label="Delete" icon={<Glyph />} />),
		).toContain("hover:text-danger");
		expect(
			renderToString(<IconButton variant="success" aria-label="Resume" icon={<Glyph />} />),
		).toContain("bg-success/10");
		expect(
			renderToString(<IconButton variant="primary" aria-label="Activate" icon={<Glyph />} />),
		).toContain("bg-accent-bright/10");
	});

	it("disables and shows a spinner while loading", () => {
		const html = renderToString(<IconButton aria-label="Sync" loading icon={<Glyph />} />);
		expect(html).toContain("disabled");
		expect(html).toContain("animate-spin");
		expect(html).not.toContain("data-test=\"glyph\"");
	});

	it("renders type=button by default and forwards aria-label", () => {
		const html = renderToString(<IconButton aria-label="Edit cohort" icon={<Glyph />} />);
		expect(html).toContain('type="button"');
		expect(html).toContain('aria-label="Edit cohort"');
	});
});
