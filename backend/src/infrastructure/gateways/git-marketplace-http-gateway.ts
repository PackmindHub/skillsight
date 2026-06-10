import type { IGitMarketplaceGateway, MarketplaceJsonData } from "@/domain/ports/git-marketplace-gateway";
import { type GitHost, type GitProvider, parseGitUrl } from "@/infrastructure/gateways/git-browse-url";

const MARKETPLACE_JSON_PATH = ".claude-plugin/marketplace.json";

// Builds the URL that returns the raw marketplace.json for a parsed git source.
//
// GitLab is fetched through the REST API "get raw file" endpoint rather than the `/-/raw/`
// web route: the web route only authenticates by browser session cookie and 302-redirects
// PRIVATE-TOKEN requests to the sign-in page, so private repos 404 even with a valid token.
// The API endpoint honors PRIVATE-TOKEN on every instance (gitlab.com and self-hosted), and
// `origin` carries the actual host so self-hosted GitLab is targeted instead of gitlab.com.
function buildMarketplaceJsonUrl(
	parsed: { host: GitHost; owner: string; repo: string; origin: string },
	branch: string,
	gitUrl: string,
): string {
	const { host, owner, repo, origin } = parsed;

	if (host === "github") {
		return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${MARKETPLACE_JSON_PATH}`;
	}
	if (host === "gitlab") {
		const project = encodeURIComponent(`${owner}/${repo}`);
		const file = encodeURIComponent(MARKETPLACE_JSON_PATH);
		return `${origin}/api/v4/projects/${project}/repository/files/${file}/raw?ref=${encodeURIComponent(branch)}`;
	}
	if (host === "bitbucket") {
		return `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${branch}/${MARKETPLACE_JSON_PATH}`;
	}

	// Generic fallback for an unrecognized host (provider="auto" + unknown hostname). Validate
	// the URL up front so we fail with a clear message instead of a bogus fetch.
	const trimmed = gitUrl.trim().replace(/\.git$/, "");
	try {
		new URL(trimmed);
	} catch {
		throw new Error(`Invalid git URL: ${gitUrl}`);
	}
	return `${trimmed}/${branch}/${MARKETPLACE_JSON_PATH}`;
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

// Builds a human-readable diagnostic from a failed git-provider fetch. We swallow
// body/header parse errors silently — we are *already* throwing, and a malformed
// response body must not mask the original HTTP status the caller cares about.
async function describeFetchFailure(
	res: Response,
	context: { what: string; hadToken: boolean; url: string },
): Promise<string> {
	const status = res.status;
	let providerMessage: string | null = null;
	try {
		const text = await res.text();
		if (text) {
			try {
				const parsed = JSON.parse(text) as unknown;
				if (parsed && typeof parsed === "object") {
					const obj = parsed as Record<string, unknown>;
					const candidate =
						(typeof obj.message === "string" && obj.message) ||
						(typeof obj.error === "string" && obj.error) ||
						(typeof obj.error_description === "string" && obj.error_description) ||
						null;
					if (candidate) providerMessage = candidate;
				}
			} catch {
				const trimmed = text.trim();
				if (trimmed && trimmed.length < 200) providerMessage = trimmed;
			}
		}
	} catch {}

	const remaining = res.headers.get("x-ratelimit-remaining");
	const reset = res.headers.get("x-ratelimit-reset");
	const isRateLimited = status === 403 && remaining === "0";

	const parts: string[] = [`HTTP ${status} ${context.what}`];
	parts.push(`URL: ${context.url}`);
	if (providerMessage) parts.push(`Response: ${providerMessage}`);
	if (isRateLimited) {
		const resetAt = reset ? new Date(Number(reset) * 1000) : null;
		const when = resetAt ? ` (resets at ${resetAt.toISOString()})` : "";
		parts.push(
			context.hadToken
				? `Rate limit reached for the configured access token${when}. Wait for the window to reset or rotate the token.`
				: `Anonymous rate limit reached${when}. GitHub allows only 60 requests/hour without authentication — add an access token in the source's Edit panel to raise the limit to 5000/hour.`,
		);
	} else if (status === 401 || status === 403) {
		parts.push(
			context.hadToken
				? "Access denied for the configured token. Verify it has not expired and that its scopes allow reading this repository (GitHub: 'public_repo' for public repos, 'repo' for private; GitLab: 'read_api')."
				: "No access token configured. If the repository is private, add a personal access token in the source's Edit panel. If it is public, GitHub may be rate-limiting anonymous requests — adding a token also raises the rate-limit ceiling.",
		);
	} else if (status === 404) {
		parts.push(
			"The path may not exist on this branch, or the repository is private and the configured credentials cannot see it.",
		);
	}
	return parts.join("\n");
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
	let firstError: unknown = null;
	const workerCount = Math.max(1, Math.min(limit, items.length));
	const workers = Array.from({ length: workerCount }, async () => {
		while (firstError === null) {
			const idx = cursor++;
			if (idx >= items.length) return;
			try {
				results[idx] = await fn(items[idx], idx);
			} catch (err) {
				if (firstError === null) firstError = err;
				return;
			}
		}
	});
	await Promise.all(workers);
	if (firstError !== null) throw firstError;
	return results;
}

// Returns the list of skill subdirectory names under <pluginPath>/skills.
// A 404 means the plugin legitimately has no /skills directory → return [].
// Any other non-OK response, JSON-parse error, or network/timeout error is
// surfaced to the caller so the whole sync is marked as failed rather than
// silently dropping plugins as if they had no skills.
async function fetchPluginSkills(params: {
	host: GitHost;
	owner: string;
	repo: string;
	origin: string;
	pluginPath: string;
	branch: string;
	accessToken?: string;
}): Promise<string[]> {
	const { host, owner, repo, origin, pluginPath, branch, accessToken } = params;
	const headers = buildHeaders(host, accessToken);
	const subPath = pluginPath ? `${pluginPath}/skills` : "skills";
	const what = `fetching skills for ${owner}/${repo}/${subPath} at ${branch}`;
	const hadToken = !!accessToken;

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
		if (res.status === 404) return [];
		if (!res.ok) throw new Error(await describeFetchFailure(res, { what, hadToken, url }));
		const items = (await res.json()) as Array<{ type: string; name: string }>;
		return items.filter((i) => i.type === "dir").map((i) => i.name);
	}
	if (host === "gitlab") {
		const encoded = encodeURIComponent(`${owner}/${repo}`);
		const path = encodeURIComponent(subPath);
		const url = `${origin}/api/v4/projects/${encoded}/repository/tree?path=${path}&ref=${encodeURIComponent(branch)}`;
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
		if (res.status === 404) return [];
		if (!res.ok) throw new Error(await describeFetchFailure(res, { what, hadToken, url }));
		const items = (await res.json()) as Array<{ type: string; name: string }>;
		return items.filter((i) => i.type === "tree").map((i) => i.name);
	}
	if (host === "bitbucket") {
		const url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${encodeURIComponent(branch)}/${subPath}/`;
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
		if (res.status === 404) return [];
		if (!res.ok) throw new Error(await describeFetchFailure(res, { what, hadToken, url }));
		const data = (await res.json()) as { values?: Array<{ type: string; path: string }> };
		return (data.values ?? [])
			.filter((i) => i.type === "commit_directory")
			.map((i) => i.path.split("/").pop() ?? i.path);
	}
	return [];
}

export class GitMarketplaceHttpGateway implements IGitMarketplaceGateway {
	async fetchMarketplaceJson(params: {
		gitUrl: string;
		accessToken?: string;
		branch?: string;
		provider?: GitProvider;
	}): Promise<MarketplaceJsonData> {
		const branch = params.branch?.trim() || "main";
		const { host, owner, repo, origin } = parseGitUrl(params.gitUrl, params.provider ?? "auto");
		const url = buildMarketplaceJsonUrl({ host, owner, repo, origin }, branch, params.gitUrl);
		const headers = buildHeaders(host, params.accessToken);

		const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });

		if (!res.ok) {
			throw new Error(
				await describeFetchFailure(res, {
					what: `fetching marketplace.json (branch "${branch}")`,
					hadToken: !!params.accessToken,
					url,
				}),
			);
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

		const fetchedPlugins = await mapWithConcurrency(rawPlugins, 8, async (p) => {
			const name = p.name as string;
			const description = typeof p.description === "string" ? p.description : undefined;
			const version = typeof p.version === "string" ? p.version : undefined;
			if (isLocalPlugin(p.source)) {
				const pluginPath = (p.source as string).replace(/^\.\//, "");
				const skills = await fetchPluginSkills({
					host,
					owner,
					repo,
					origin,
					pluginPath,
					branch,
					accessToken: params.accessToken,
				});
				return { name, description, version, skills, source: pluginPath };
			}
			const external = parseExternalPluginSource(p.source);
			if (external) {
				// External plugin URLs are arbitrary, so they are always auto-detected (the
				// source's pinned provider does not apply to them). Self-hosted external plugins
				// therefore remain unsupported and fall through to "other" → no skills.
				const ext = parseGitUrl(external.url);
				if (ext.host === "other" || !ext.owner || !ext.repo) {
					return { name, description, version };
				}
				// Forward the marketplace's access token only when the external plugin lives on the
				// exact same host AND origin as the marketplace itself — a GitHub PAT cannot auth to
				// GitLab, and a token for one GitLab instance must not leak to another. We must not
				// send it to an unrelated host that a (potentially malicious) marketplace.json names.
				const forwardToken = ext.host === host && ext.origin === origin ? params.accessToken : undefined;
				const skills = await fetchPluginSkills({
					host: ext.host,
					owner: ext.owner,
					repo: ext.repo,
					origin: ext.origin,
					pluginPath: external.path,
					branch: external.ref ?? "HEAD",
					accessToken: forwardToken,
				});
				// Intentionally no `source` value: `plugins.source` is consumed downstream by
				// buildSkillRepoUrl as a path inside the *marketplace's* own repo, which doesn't
				// apply to external git-subdir plugins. Leaving it null yields a null skillRepoUrl
				// rather than a broken link; plumbing an external browse URL is a separate change.
				return { name, description, version, skills };
			}
			return { name, description, version };
		});

		// Return every plugin from marketplace.json, including ones with `skills: []`.
		// We used to filter those out here, but the downstream sync use case then treated
		// the filtered list as the ground truth for `markRemovedByMarketplace`, which
		// silently flipped plugins-without-skills to `status='removed'` even though they
		// were still listed in marketplace.json. Transient per-plugin fetch errors still
		// throw out of fetchPluginSkills (so the whole sync is marked errored before we
		// get here), meaning anything in `fetchedPlugins` reflects what the marketplace
		// actually publishes.
		return {
			name: obj.name,
			description: typeof obj.description === "string" ? obj.description : undefined,
			plugins: fetchedPlugins,
		};
	}
}
