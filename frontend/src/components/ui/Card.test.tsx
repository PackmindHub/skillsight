import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { Card, CardBody, CardFooter, CardHeader } from "./Card";

describe("Card", () => {
	it("renders with default sunken surface and md padding", () => {
		const html = renderToString(<Card>content</Card>);
		expect(html).toContain("bg-surface-900");
		expect(html).toContain("p-4");
	});

	it("supports raised surface and padding variants", () => {
		expect(renderToString(<Card surface="raised">x</Card>)).toContain("bg-surface-700");
		expect(renderToString(<Card padding="lg">x</Card>)).toContain("p-6");
		expect(renderToString(<Card padding="none">x</Card>)).not.toContain("p-4");
	});

	it("toggles interactive hover state", () => {
		const html = renderToString(<Card interactive>x</Card>);
		expect(html).toContain("cursor-pointer");
		expect(html).toContain("hover:border-accent-bright");
	});

	it("renders header/body/footer composition", () => {
		const html = renderToString(
			<Card>
				<CardHeader>head</CardHeader>
				<CardBody>body</CardBody>
				<CardFooter>foot</CardFooter>
			</Card>,
		);
		expect(html).toContain("head");
		expect(html).toContain("body");
		expect(html).toContain("foot");
	});
});
