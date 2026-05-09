import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useStatusFilter } from "./use-status-filter";

const STATUSES = ["unknown", "to_review", "approved", "removed"] as const;

function Probe({ initialUrl }: { initialUrl: string }) {
	const { status } = useStatusFilter("status", STATUSES);
	const [params] = useSearchParams();
	return <span data-status={status} data-raw={params.get("status") ?? ""} data-init={initialUrl} />;
}

function render(initialUrl: string): string {
	return renderToString(
		<MemoryRouter initialEntries={[initialUrl]}>
			<Probe initialUrl={initialUrl} />
		</MemoryRouter>,
	);
}

describe("useStatusFilter", () => {
	it("returns 'all' when the param is absent", () => {
		const html = render("/skills");
		expect(html).toContain('data-status="all"');
	});

	it("returns the param value when it matches an allowed status", () => {
		const html = render("/skills?status=approved");
		expect(html).toContain('data-status="approved"');
	});

	it("falls back to 'all' for invalid values", () => {
		const html = render("/skills?status=bogus");
		expect(html).toContain('data-status="all"');
	});

	it("preserves the raw param when valid", () => {
		const html = render("/skills?status=to_review");
		expect(html).toContain('data-raw="to_review"');
	});
});
