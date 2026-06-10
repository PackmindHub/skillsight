import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { GitMarketplaceHttpGateway } from "./git-marketplace-http-gateway";

type FetchCall = { url: string; init?: RequestInit };

type ResponderResult = {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
};

type Responder = (call: FetchCall) => ResponderResult | Promise<ResponderResult>;

const realFetch = globalThis.fetch;
let calls: FetchCall[] = [];
let responder: Responder = () => ({ status: 404 });

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
	});
}

beforeEach(() => {
	calls = [];
	responder = () => ({ status: 404 });
	globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input.toString();
		calls.push({ url, init });
		const result = await responder({ url, init });
		return jsonResponse(result.status ?? 200, result.body ?? {}, result.headers);
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

	test("404 on a plugin's /skills directory: returned with empty skills (not dropped)", async () => {
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
		expect(data.plugins).toHaveLength(2);
		const byName = Object.fromEntries(data.plugins.map((p) => [p.name, p]));
		expect(byName["with-skills"].skills).toEqual(["lint"]);
		expect(byName["no-skills-dir"].skills).toEqual([]);
	});

	test("unrecognized source shape: plugin returned without skills (not dropped)", async () => {
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
		expect(data.plugins).toHaveLength(1);
		expect(data.plugins[0].name).toBe("mystery");
		expect(data.plugins[0].skills).toBeUndefined();
		expect(calls.some((c) => c.url.includes("api.github.com"))).toBe(false);
	});

	test("local source with empty /skills directory: returned with empty skills (not dropped)", async () => {
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
		expect(data.plugins).toHaveLength(2);
		const byName = Object.fromEntries(data.plugins.map((p) => [p.name, p]));
		expect(byName["with-skills"].skills).toEqual(["lint"]);
		expect(byName["no-skills"].skills).toEqual([]);
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
		).rejects.toThrow(/HTTP 404 fetching marketplace\.json/);
	});

	test("403 anonymous rate-limit surfaces provider message, reset time, and a token hint", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "acme",
						plugins: [{ name: "plugin-a", source: "./plugins/a" }],
					},
				};
			}
			return {
				status: 403,
				body: { message: "API rate limit exceeded for 1.2.3.4." },
				headers: {
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": "1700000000",
				},
			};
		};
		await expect(
			new GitMarketplaceHttpGateway().fetchMarketplaceJson({
				gitUrl: "https://github.com/acme/marketplace",
			}),
		).rejects.toMatchObject({
			message: expect.stringContaining("Anonymous rate limit reached"),
		});
		// The provider's body message and the upstream URL must also appear so an
		// operator can debug without needing server logs.
		const err = await new GitMarketplaceHttpGateway()
			.fetchMarketplaceJson({ gitUrl: "https://github.com/acme/marketplace" })
			.catch((e) => e as Error);
		expect(err.message).toContain("API rate limit exceeded");
		expect(err.message).toContain("api.github.com/repos/acme/marketplace/contents/plugins/a/skills");
		expect(err.message).toContain("resets at");
	});

	test("403 with a configured token tells the operator to check token scopes (not anonymous-limit copy)", async () => {
		responder = ({ url }) => {
			if (url.includes("raw.githubusercontent.com")) {
				return {
					body: {
						name: "acme",
						plugins: [{ name: "plugin-a", source: "./plugins/a" }],
					},
				};
			}
			return {
				status: 403,
				body: { message: "Resource not accessible by personal access token" },
			};
		};
		const err = await new GitMarketplaceHttpGateway()
			.fetchMarketplaceJson({
				gitUrl: "https://github.com/acme/marketplace",
				accessToken: "ghp_xxx",
			})
			.catch((e) => e as Error);
		expect(err.message).toContain("Access denied for the configured token");
		expect(err.message).toContain("Resource not accessible");
		expect(err.message).not.toContain("Anonymous rate limit");
	});

	test("self-hosted GitLab: marketplace.json + skills fetched via the REST API on the source's own origin", async () => {
		let mpUrl: string | null = null;
		let mpPrivateToken: string | null | undefined;
		let skillUrl: string | null = null;
		responder = ({ url, init }) => {
			if (
				url.includes("gitlab.example.com/api/v4/projects/") &&
				url.includes("/repository/files/")
			) {
				mpUrl = url;
				mpPrivateToken = new Headers(init?.headers).get("private-token");
				return {
					body: { name: "self-hosted", plugins: [{ name: "plugin-a", source: "./plugins/a" }] },
				};
			}
			if (
				url.includes("gitlab.example.com/api/v4/projects/") &&
				url.includes("/repository/tree")
			) {
				skillUrl = url;
				return {
					body: [
						{ type: "tree", name: "lint" },
						{ type: "blob", name: "README.md" },
					],
				};
			}
			return { status: 404 };
		};
		const data = await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://gitlab.example.com/group/repo",
			accessToken: "glpat-secret",
			provider: "gitlab",
		});
		// Project id is the URL-encoded full path; file path is URL-encoded too.
		expect(mpUrl).toContain("/api/v4/projects/group%2Frepo/repository/files/");
		expect(mpUrl).toContain("marketplace.json/raw?ref=main");
		// PRIVATE-TOKEN must be honored — that's the whole point of the API route.
		expect(mpPrivateToken).toBe("glpat-secret");
		// The web `/-/raw/` route must never be used (it 302s token auth to login).
		expect(calls.every((c) => !c.url.includes("/-/raw/"))).toBe(true);
		expect(skillUrl).toContain("gitlab.example.com/api/v4/projects/group%2Frepo/repository/tree");
		expect(data.plugins[0]).toMatchObject({ name: "plugin-a", skills: ["lint"] });
	});

	test("gitlab.com: marketplace.json now uses the REST raw-file API (fixes private-repo 302), not /-/raw/", async () => {
		let mpUrl: string | null = null;
		responder = ({ url }) => {
			if (url.includes("gitlab.com/api/v4/projects/") && url.includes("/repository/files/")) {
				mpUrl = url;
				return { body: { name: "mp", plugins: [] } };
			}
			return { status: 404 };
		};
		await new GitMarketplaceHttpGateway().fetchMarketplaceJson({
			gitUrl: "https://gitlab.com/acme/marketplace",
		});
		expect(mpUrl).toContain("gitlab.com/api/v4/projects/acme%2Fmarketplace/repository/files/");
		expect(calls.every((c) => !c.url.includes("/-/raw/"))).toBe(true);
	});
});
