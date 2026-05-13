import type { IGitMarketplaceGateway, MarketplaceJsonData } from "@/domain/ports/git-marketplace-gateway";
import { parseGitUrl } from "@/infrastructure/gateways/git-browse-url";

function resolveRawUrl(gitUrl: string, branch: string): { url: string; host: "github" | "gitlab" | "bitbucket" | "other" } {
	const trimmed = gitUrl.trim().replace(/\.git$/, "");

	// GitHub shorthand: owner/repo (no https://, no extra slashes in the path beyond one)
	if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
		return {
			url: `https://raw.githubusercontent.com/${trimmed}/${branch}/.claude-plugin/marketplace.json`,
			host: "github",
		};
	}

	try {
		const parsed = new URL(trimmed);
		const pathParts = parsed.pathname.replace(/^\//, "").split("/");

		if (parsed.hostname === "github.com") {
			const [owner, repo] = pathParts;
			return {
				url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.claude-plugin/marketplace.json`,
				host: "github",
			};
		}

		if (parsed.hostname === "gitlab.com") {
			const repoPath = parsed.pathname.replace(/^\//, "");
			return {
				url: `https://gitlab.com/${repoPath}/-/raw/${branch}/.claude-plugin/marketplace.json`,
				host: "gitlab",
			};
		}

		if (parsed.hostname === "bitbucket.org") {
			const [workspace, repo] = pathParts;
			return {
				url: `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/src/${branch}/.claude-plugin/marketplace.json`,
				host: "bitbucket",
			};
		}

		// Generic: append the standard path
		return {
			url: `${trimmed}/${branch}/.claude-plugin/marketplace.json`,
			host: "other",
		};
	} catch {
		throw new Error(`Invalid git URL: ${gitUrl}`);
	}
}

function buildHeaders(host: string, accessToken?: string): Record<string, string> {
	const headers: Record<string, string> = { Accept: "application/json" };
	if (!accessToken) return headers;
	if (host === "gitlab") {
		headers["PRIVATE-TOKEN"] = accessToken;
	} else {
		headers.Authorization = `Bearer ${accessToken}`;
	}
	return headers;
}

function isLocalPlugin(source: unknown): source is string {
	if (typeof source !== "string") return false;
	if (source.startsWith("http") || source.startsWith("git@")) return false;
	return true;
}

type ExternalPluginSource = {
	url: string;
	path: string;
	ref: string | null;
};

// Recognizes the object form of marketplace.json `plugins[].source`. Two shapes are common:
//   { source: "git-subdir", url, path, ref?, sha? } — plugin lives at <path> inside <url> at <ref>.
//   { source: "git" | "github", url, ref?, sha? }   — the whole external repo is the plugin (path="").
// Returns null for any shape we can't safely interpret.
function parseExternalPluginSource(raw: unknown): ExternalPluginSource | null {
	if (typeof raw !== "object" || raw === null) return null;
	const obj = raw as Record<string, unknown>;
	const kind = typeof obj.source === "string" ? obj.source : null;
	const url = typeof obj.url === "string" && obj.url ? obj.url : null;
	if (!url) return null;
	const ref = typeof obj.ref === "string" && obj.ref ? obj.ref : null;
	const rawPath = typeof obj.path === "string" ? obj.path.replace(/^\/+|\/+$/g, "") : "";
	if (kind === "git-subdir") {
		if (!rawPath) return null;
		return { url, path: rawPath, ref };
	}
	if (kind === "git" || kind === "github") {
		return { url, path: rawPath, ref };
	}
	return null;
}

async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let cursor = 0;
	const workerCount = Math.max(1, Math.min(limit, items.length));
	const workers = Array.from({ length: workerCount }, async () => {
		while (true) {
			const idx = cursor++;
			if (idx >= items.length) return;
			results[idx] = await fn(items[idx], idx);
		}
	});
	await Promise.all(workers);
	return results;
}

async function fetchPluginSkills(params: {
	host: "github" | "gitlab" | "bitbucket" | "other";
	owner: string;
	repo: string;
	pluginPath: string;
	branch: string;
	accessToken?: string;
}): Promise<string[]> {
	const { host, owner, repo, pluginPath, branch, accessToken } = params;
	const headers = buildHeaders(host, accessToken);
	const subPath = pluginPath ? `${pluginPath}/skills` : "skills";
	try {
		if (host === "github") {
			const url = `https://api.github.com/repos/${owner}/${repo}/contents/${subPath}?ref=${encodeURIComponent(branch)}`;
			const res = await fetch(url, {
				headers: {
					...headers,
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				signal: AbortSignal.timeout(10_000),
			});
			if (!res.ok) return [];
			const items = (await res.json()) as Array<{ type: string; name: string }>;
			return items.filter((i) => i.type === "dir").map((i) => i.name);
		}
		if (host === "gitlab") {
			const encoded = encodeURIComponent(`${owner}/${repo}`);
			const path = encodeURIComponent(subPath);
			const url = `https://gitlab.com/api/v4/projects/${encoded}/repository/tree?path=${path}&ref=${encodeURIComponent(branch)}`;
			const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
			if (!res.ok) return [];
			const items = (await res.json()) as Array<{ type: string; name: string }>;
			return items.filter((i) => i.type === "tree").map((i) => i.name);
		}
		if (host === "bitbucket") {
			const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${encodeURIComponent(branch)}/${subPath}/`;
			const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
			if (!res.ok) return [];
			const data = (await res.json()) as { values?: Array<{ type: string; path: string }> };
			return (data.values ?? [])
				.filter((i) => i.type === "commit_directory")
				.map((i) => i.path.split("/").pop() ?? i.path);
		}
		return [];
	} catch {
		return [];
	}
}

export class GitMarketplaceHttpGateway implements IGitMarketplaceGateway {
	async fetchMarketplaceJson(params: {
		gitUrl: string;
		accessToken?: string;
		branch?: string;
	}): Promise<MarketplaceJsonData> {
		const branch = params.branch?.trim() || "main";
		const { url } = resolveRawUrl(params.gitUrl, branch);
		const { host, owner, repo } = parseGitUrl(params.gitUrl);
		const headers = buildHeaders(host, params.accessToken);

		const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

		if (res.status === 401 || res.status === 403) {
			throw new Error(`Authentication failed (HTTP ${res.status}). Check the access token.`);
		}
		if (res.status === 404) {
			throw new Error(`marketplace.json not found (HTTP 404). Check the git URL and branch ("${branch}").`);
		}
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} fetching marketplace.json from ${url}`);
		}

		let data: unknown;
		try {
			data = await res.json();
		} catch {
			throw new Error("Response from git host is not valid JSON.");
		}

		if (typeof data !== "object" || data === null) {
			throw new Error("marketplace.json must be a JSON object.");
		}
		const obj = data as Record<string, unknown>;
		if (typeof obj.name !== "string" || !obj.name) {
			throw new Error('marketplace.json is missing required "name" field.');
		}
		if (!Array.isArray(obj.plugins)) {
			throw new Error('marketplace.json is missing required "plugins" array.');
		}

		const rawPlugins = (obj.plugins as unknown[])
			.filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
			.filter((p) => typeof p.name === "string" && p.name);

		const plugins = await mapWithConcurrency(rawPlugins, 8, async (p) => {
			const name = p.name as string;
			const description = typeof p.description === "string" ? p.description : undefined;
			const version = typeof p.version === "string" ? p.version : undefined;
			if (isLocalPlugin(p.source)) {
				const pluginPath = (p.source as string).replace(/^\.\//, "");
				const skills = await fetchPluginSkills({
					host,
					owner,
					repo,
					pluginPath,
					branch,
					accessToken: params.accessToken,
				});
				return { name, description, version, skills, source: pluginPath };
			}
			const external = parseExternalPluginSource(p.source);
			if (external) {
				const ext = parseGitUrl(external.url);
				if (ext.host === "other" || !ext.owner || !ext.repo) {
					return { name, description, version };
				}
				const skills = await fetchPluginSkills({
					host: ext.host,
					owner: ext.owner,
					repo: ext.repo,
					pluginPath: external.path,
					branch: external.ref ?? "HEAD",
				});
				// Intentionally no `source` value: `plugins.source` is consumed downstream by
				// buildSkillRepoUrl as a path inside the *marketplace's* own repo, which doesn't
				// apply to external git-subdir plugins. Leaving it null yields a null skillRepoUrl
				// rather than a broken link; plumbing an external browse URL is a separate change.
				return { name, description, version, skills };
			}
			return { name, description, version };
		});

		return {
			name: obj.name,
			description: typeof obj.description === "string" ? obj.description : undefined,
			plugins,
		};
	}
}
