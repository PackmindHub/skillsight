import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { GitMarketplaceHttpGateway } from "./git-marketplace-http-gateway";

type FetchCall = { url: string; init?: RequestInit };

type Responder = (call: FetchCall) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

const realFetch = globalThis.fetch;
let calls: FetchCall[] = [];
let responder: Responder = () => ({ status: 404 });

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	calls = [];
	responder = () => ({ status: 404 });
	globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input.toString();
		calls.push({ url, init });
		const result = await responder({ url, init });
		return jsonResponse(result.status ?? 200, result.body ?? {});
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("GitMarketplaceHttpGateway.fetchMarketplaceJson", () => {
	test("local string source: fetches skills from the marketplace's own repo", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "acme",
						plugins: [{ name: "plugin-a", source: "./plugins/a" }],
					},
				};
			}
			if (url.includes("/contents/plugins/a/skills")) {
				return {
					body: [
						{ type: "dir", name: "lint" },
						{ type: "file", name: "README.md" },
						{ type: "dir", name: "format" },
					],
				};
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(data.plugins).toHaveLength(1);
		expect(data.plugins[0]).toMatchObject({
			name: "plugin-a",
			skills: ["lint", "format"],
			source: "plugins/a",
		});
	});

	test("git-subdir source: fetches skills from the external repo at the right ref/path", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "claude-plugins-official",
						plugins: [
							{
								name: "42crunch-api-security-testing",
								source: {
									source: "git-subdir",
									url: "https://github.com/42Crunch-AI/claude-plugins.git",
									path: "plugins/api-security-testing",
									ref: "v1.0.1",
									sha: "deadbeef",
								},
							},
						],
					},
				};
			}
			if (
				url.startsWith(
					"https://api.github.com/repos/42Crunch-AI/claude-plugins/contents/plugins/api-security-testing/skills",
				) &&
				url.includes("ref=v1.0.1")
			) {
				return { body: [{ type: "dir", name: "openapi-audit" }] };
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/anthropics/claude-plugins-official",
		});
		expect(data.plugins[0]).toMatchObject({
			name: "42crunch-api-security-testing",
			skills: ["openapi-audit"],
		});
		expect(data.plugins[0].source).toBeUndefined();
	});

	test("bare {source:'github', url, ref}: hits /contents/skills with no double slash", async () => {
		let skillCall: string | null = null;
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "mp",
						plugins: [
							{
								name: "whole-repo-plugin",
								source: {
									source: "github",
									url: "https://github.com/org/whole-plugin",
									ref: "main",
								},
							},
						],
					},
				};
			}
			if (url.includes("api.github.com/repos/org/whole-plugin/contents/")) {
				skillCall = url;
				return { body: [{ type: "dir", name: "alpha" }] };
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(skillCall).not.toBeNull();
		expect(skillCall).not.toContain("contents//skills");
		expect(skillCall).toContain("/contents/skills?ref=main");
		expect(data.plugins[0]).toMatchObject({
			name: "whole-repo-plugin",
			skills: ["alpha"],
		});
	});

	test("external 403 on skills fetch: throws so the sync is marked errored (not silently emptied)", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "mp",
						plugins: [
							{
								name: "rate-limited",
								source: {
									source: "git-subdir",
									url: "https://github.com/foo/bar",
									path: "plugins/x",
									ref: "main",
								},
							},
						],
					},
				};
			}
			if (url.includes("api.github.com")) return { status: 403 };
			return { status: 404 };
		};
		await expect(
			new GitMarketplaceHttpGateway().fetchMarketplaceJson({
				gitUrl: "https://github.com/acme/marketplace",
			}),
		).rejects.toThrow(/HTTP 403 fetching skills/);
	});

	test("404 on a plugin's /skills directory: treated as legitimately empty (plugin dropped)", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "acme",
						plugins: [
							{ name: "with-skills", source: "./plugins/a" },
							{ name: "no-skills-dir", source: "./plugins/b" },
						],
					},
				};
			}
			if (url.includes("/contents/plugins/a/skills")) {
				return { body: [{ type: "dir", name: "lint" }] };
			}
			if (url.includes("/contents/plugins/b/skills")) {
				return { status: 404 };
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(data.plugins).toHaveLength(1);
		expect(data.plugins[0].name).toBe("with-skills");
	});

	test("unrecognized source shape: plugin dropped (no skills)", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "mp",
						plugins: [
							{ name: "mystery", source: { kind: "future-format", value: "???" } },
						],
					},
				};
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(data.plugins).toEqual([]);
		expect(calls.some((c) => c.url.includes("api.github.com"))).toBe(false);
	});

	test("local source with empty /skills directory: plugin dropped", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "acme",
						plugins: [
							{ name: "with-skills", source: "./plugins/a" },
							{ name: "no-skills", source: "./plugins/b" },
						],
					},
				};
			}
			if (url.includes("/contents/plugins/a/skills")) {
				return { body: [{ type: "dir", name: "lint" }] };
			}
			if (url.includes("/contents/plugins/b/skills")) {
				return { body: [{ type: "file", name: "README.md" }] };
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(data.plugins).toHaveLength(1);
		expect(data.plugins[0].name).toBe("with-skills");
	});

	test("concurrency cap: in-flight cross-repo fetches never exceed 8", async () => {
		const pluginCount = 30;
		const plugins = Array.from({ length: pluginCount }, (_, i) => ({
			name: `p-${i}`,
			source: {
				source: "git-subdir",
				url: `https://github.com/owner/repo-${i}`,
				path: `plugins/p-${i}`,
				ref: "main",
			},
		}));
		let inFlight = 0;
		let peak = 0;
		responder = async ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return { body: { name: "mp", plugins } };
			}
			if (url.includes("api.github.com")) {
				inFlight++;
				peak = Math.max(peak, inFlight);
				await new Promise((r) => setTimeout(r, 10));
				inFlight--;
				return { body: [{ type: "dir", name: "skill-a" }] };
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
		});
		expect(data.plugins).toHaveLength(pluginCount);
		expect(peak).toBeGreaterThan(0);
		expect(peak).toBeLessThanOrEqual(8);
	});

	test("same-host external plugin: forwards the marketplace access token to the skills fetch", async () => {
		let skillCallAuth: string | null | undefined;
		responder = ({ url, init }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "mp",
						plugins: [
							{
								name: "private-external",
								source: {
									source: "git-subdir",
									url: "https://github.com/acme/private-plugins",
									path: "plugins/x",
									ref: "main",
								},
							},
						],
					},
				};
			}
			if (url.includes("api.github.com/repos/acme/private-plugins/contents/plugins/x/skills")) {
				const headers = new Headers(init?.headers);
				skillCallAuth = headers.get("authorization");
				return { body: [{ type: "dir", name: "alpha" }] };
			}
			return { status: 404 };
		};
		await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://github.com/acme/marketplace",
			accessToken: "ghp_secret",
		});
		expect(skillCallAuth).toBe("Bearer ghp_secret");
	});

	test("cross-host external plugin: token is NOT forwarded (avoids leaking PAT)", async () => {
		let skillCallAuth: string | null | undefined;
		let skillCallPrivateToken: string | null | undefined;
		responder = ({ url, init }) => {
			// Marketplace lives on gitlab.com — should authenticate marketplace.json with PRIVATE-TOKEN.
			if (url.includes("gitlab.com") && url.includes("marketplace.json")) {
				return {
					body: {
						name: "mp",
						plugins: [
							{
								name: "github-plugin",
								source: {
									source: "git-subdir",
									url: "https://github.com/foo/bar",
									path: "plugins/x",
									ref: "main",
								},
							},
						],
					},
				};
			}
			if (url.includes("api.github.com/repos/foo/bar/contents/plugins/x/skills")) {
				const headers = new Headers(init?.headers);
				skillCallAuth = headers.get("authorization");
				skillCallPrivateToken = headers.get("private-token");
				return { body: [{ type: "dir", name: "alpha" }] };
			}
			return { status: 404 };
		};
		await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://gitlab.com/acme/marketplace",
			accessToken: "glpat-secret",
		});
		expect(skillCallAuth).toBeNull();
		expect(skillCallPrivateToken).toBeNull();
	});

	test("marketplace.json 404 throws a descriptive error", async () => {
		responder = () => ({ status: 404 });
		await expect(
			new GitMarketplaceHttpGateway().fetchMarketplaceJson({
				gitUrl: "https://github.com/acme/marketplace",
			}),
		).rejects.toThrow(/marketplace\.json not found/);
	});
});
