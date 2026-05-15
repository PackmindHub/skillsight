import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { Button } from "./Button";

describe("Button", () => {
	it("renders children and a default primary variant", () => {
		const html = renderToString(<Button>Save</Button>);
		expect(html).toContain("Save");
		expect(html).toContain("btn-primary");
	});

	it("applies size classes", () => {
		expect(renderToString(<Button size="sm">A</Button>)).toContain("h-8");
		expect(renderToString(<Button size="md">A</Button>)).toContain("h-9");
	});

	it("applies secondary, ghost, danger, and success variants", () => {
		expect(renderToString(<Button variant="secondary">A</Button>)).toContain("bg-surface-700");
		expect(renderToString(<Button variant="ghost">A</Button>)).toContain("hover:bg-surface-700");
		expect(renderToString(<Button variant="danger">A</Button>)).toContain("text-danger");
		expect(renderToString(<Button variant="success">A</Button>)).toContain("btn-success");
	});

	it("disables and shows a spinner while loading", () => {
		const html = renderToString(<Button loading>Save</Button>);
		expect(html).toContain("disabled");
		expect(html).toContain("animate-spin");
	});

	it("supports fullWidth", () => {
		expect(renderToString(<Button fullWidth>X</Button>)).toContain("w-full");
	});

	it("renders type=button by default", () => {
		expect(renderToString(<Button>X</Button>)).toContain('type="button"');
	});

	it("asChild merges classes onto the child element", () => {
		const html = renderToString(
			<Button asChild>
				<a href="/x">Go</a>
			</Button>,
		);
		expect(html).toContain('href="/x"');
		expect(html).toContain("btn-primary");
	});
});
