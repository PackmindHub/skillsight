import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { EmptyRow, TBody, TD, TH, THead, TR, Table } from "./Table";

describe("Table", () => {
	it("wraps the table in a bordered surface", () => {
		const html = renderToString(
			<Table>
				<THead>
					<TR>
						<TH>Name</TH>
					</TR>
				</THead>
				<TBody>
					<TR>
						<TD>Alice</TD>
					</TR>
				</TBody>
			</Table>,
		);
		expect(html).toContain("bg-surface-900");
		expect(html).toContain("border-edge");
		expect(html).toContain("Name");
		expect(html).toContain("Alice");
	});

	it("applies numeric alignment and tabular-nums on TD", () => {
		const html = renderToString(<TD numeric>123</TD>);
		expect(html).toContain("text-right");
		expect(html).toContain("tabular-nums");
	});

	it("applies highlighted row style", () => {
		const html = renderToString(<TR highlighted>x</TR>);
		expect(html).toContain("bg-accent-bright");
	});

	it("renders EmptyRow with colSpan", () => {
		const html = renderToString(<EmptyRow colSpan={3}>No data</EmptyRow>);
		expect(html).toMatch(/colSpan="3"/i);
		expect(html).toContain("No data");
	});

	it("makes TR clickable when onClick is provided", () => {
		const html = renderToString(<TR onClick={() => {}}>row</TR>);
		expect(html).toContain("cursor-pointer");
	});
});
