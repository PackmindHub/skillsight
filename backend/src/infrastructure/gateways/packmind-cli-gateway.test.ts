import { describe, expect, test } from "bun:test";
import {
	parsePackageShow,
	parsePackagesList,
	parseWhoami,
	stripCliNoise,
} from "./packmind-cli-gateway";

const PACKAGES_LIST_FIXTURE = `Fetching spaces
[2K[1A[2K[GFetching packages
[2K[1A[2K[G📦 Packages (5)

Space: Backend

- @backend/generic
 Name: Generic
 https://app.packmind.ai/org/packmind/space/backend/packages/405f9c33-c86f-40fb-a7f2-51890f6b1aea

- @backend/hexagonal-architecture
 Name: Hexagonal Architecture
 https://app.packmind.ai/org/packmind/space/backend/packages/a4fc787c-a97d-4e35-adbf-e1c7b1375dac

Space: Global

- @global/generic
 Name: Generic
 https://app.packmind.ai/org/packmind/space/global/packages/c0b4f2b0-abda-4156-9d3b-5c3fac1efca8

- @global/proprietary
 Name: Proprietary
 https://app.packmind.ai/org/packmind/space/global/packages/72851a01-4230-4838-ba7a-fb26f3e95ff3

Space: Testing

- @testing/cli-e2e
 Name: CLI e2e
 https://app.packmind.ai/org/packmind/space/testing/packages/55cfbdf0-0ce1-403b-8bd5-96344836f315

How to install a package:

  Example: packmind-cli install @backend/generic
`;

const PACKAGES_SHOW_FIXTURE = `packmind-cli Fetching package details for '@backend/generic'...

Generic (@backend/generic):

Standards:
  - Compliance - Logging Personal Information: Enforce masking of personal information in TypeScript logs.

Commands:
  - Create New Package
  - Create or update model and TypeORM schemas

Skills:
  - adding-ai-agent-rendering-system: Implement a new Packmind AI agent rendering/deployer pipeline (single-file or multi-file) with type and registry wiring,
    frontend UI/docs updates, and thorough unit/integration tests.
  - hexagonal-architecture: Describes the hexagonal architecture (ports and adapters) used across the Packmind monorepo.
`;

const WHOAMI_FIXTURE = `packmind-cli Authenticated

Host: https://app.packmind.ai
Organization: packmind
User: cedric.teyton@packmind.com
Expires in 55 days
packmind-cli Source: /Users/cedricteyton/.packmind/credentials.json
`;

describe("stripCliNoise", () => {
	test("strips ANSI control sequences and Fetching lines", () => {
		const stripped = stripCliNoise("Fetching spaces\n[2K[1A[2K[GHello\n");
		expect(stripped.includes("Fetching")).toBe(false);
		expect(stripped.includes("Hello")).toBe(true);
	});
});

describe("parsePackagesList", () => {
	test("extracts all 5 packages across 3 spaces", () => {
		const out = parsePackagesList(PACKAGES_LIST_FIXTURE);
		expect(out.length).toBe(5);
		const slugs = out.map((p) => p.slug);
		expect(slugs).toContain("@backend/generic");
		expect(slugs).toContain("@backend/hexagonal-architecture");
		expect(slugs).toContain("@global/proprietary");
		expect(slugs).toContain("@testing/cli-e2e");
	});

	test("preserves display name, url, and space metadata per package", () => {
		const out = parsePackagesList(PACKAGES_LIST_FIXTURE);
		const hex = out.find((p) => p.slug === "@backend/hexagonal-architecture");
		expect(hex).toBeDefined();
		expect(hex?.displayName).toBe("Hexagonal Architecture");
		expect(hex?.spaceSlug).toBe("@backend");
		expect(hex?.spaceName).toBe("Backend");
		expect(hex?.url).toContain("app.packmind.ai");

		const cli = out.find((p) => p.slug === "@testing/cli-e2e");
		expect(cli?.spaceName).toBe("Testing");
		expect(cli?.displayName).toBe("CLI e2e");
	});

	test("returns empty array on empty input", () => {
		expect(parsePackagesList("")).toEqual([]);
	});
});

describe("parsePackageShow", () => {
	test("extracts skills with single-line descriptions", () => {
		const detail = parsePackageShow(PACKAGES_SHOW_FIXTURE, "@backend/generic");
		expect(detail.slug).toBe("@backend/generic");
		expect(detail.displayName).toBe("Generic");
		expect(detail.skills.length).toBe(2);
		const hex = detail.skills.find((s) => s.name === "hexagonal-architecture");
		expect(hex?.description).toContain("hexagonal architecture");
	});

	test("merges continuation lines into the previous skill's description", () => {
		const detail = parsePackageShow(PACKAGES_SHOW_FIXTURE, "@backend/generic");
		const renderer = detail.skills.find((s) => s.name === "adding-ai-agent-rendering-system");
		expect(renderer?.description).toContain("rendering/deployer pipeline");
		expect(renderer?.description).toContain("frontend UI/docs updates");
	});

	test("ignores Standards and Commands sections", () => {
		const detail = parsePackageShow(PACKAGES_SHOW_FIXTURE, "@backend/generic");
		// The Skills section contains exactly two skill bullets; if Standards/Commands
		// leaked through they'd appear as extra entries.
		expect(detail.skills.length).toBe(2);
	});

	test("returns empty skills when no Skills section is present", () => {
		const detail = parsePackageShow("Generic (@x/y):\n\nStandards:\n  - whatever\n", "@x/y");
		expect(detail.skills).toEqual([]);
	});
});

describe("parseWhoami", () => {
	test("extracts user, org, and host", () => {
		const w = parseWhoami(WHOAMI_FIXTURE);
		expect(w.user).toBe("cedric.teyton@packmind.com");
		expect(w.org).toBe("packmind");
		expect(w.host).toBe("https://app.packmind.ai");
	});

	test("throws on garbled output", () => {
		expect(() => parseWhoami("not authenticated")).toThrow();
	});
});
