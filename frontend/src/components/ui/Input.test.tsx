import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { Input } from "./Input";

describe("Input", () => {
	it("renders an input element with the base classes", () => {
		const html = renderToString(<Input placeholder="hi" />);
		expect(html).toContain("<input");
		expect(html).toContain("bg-surface-800");
		expect(html).toContain('placeholder="hi"');
	});

	it("applies size classes", () => {
		expect(renderToString(<Input size="sm" />)).toContain("h-8");
		expect(renderToString(<Input size="md" />)).toContain("h-9");
	});

	it("toggles invalid classes", () => {
		const html = renderToString(<Input invalid />);
		expect(html).toContain("border-danger");
	});

	it("renders left/right slots and pads accordingly", () => {
		const html = renderToString(<Input leftSlot={<span>L</span>} rightSlot={<span>R</span>} />);
		expect(html).toContain("pl-9");
		expect(html).toContain("pr-9");
		expect(html).toContain(">L<");
		expect(html).toContain(">R<");
	});
});
