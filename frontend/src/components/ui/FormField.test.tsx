import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { FormField } from "./FormField";

describe("FormField", () => {
	it("renders label and helper text", () => {
		const html = renderToString(
			<FormField label="Email" helper="We never share it.">
				<input />
			</FormField>,
		);
		expect(html).toContain("Email");
		expect(html).toContain("We never share it.");
	});

	it("shows error instead of helper when provided", () => {
		const html = renderToString(
			<FormField label="Email" helper="hint" error="Required">
				<input />
			</FormField>,
		);
		expect(html).toContain("Required");
		expect(html).not.toContain("hint");
		expect(html).toContain("text-danger");
	});

	it("marks required fields with an asterisk", () => {
		const html = renderToString(
			<FormField label="Email" required>
				<input />
			</FormField>,
		);
		expect(html).toContain("*");
	});

	it("wires htmlFor onto the label", () => {
		const html = renderToString(
			<FormField label="Email" htmlFor="email-id">
				<input id="email-id" />
			</FormField>,
		);
		expect(html).toContain('for="email-id"');
	});
});
