import type { GitProvider } from "@/domain/marketplace-source";

export type { GitProvider };
export type GitHost = "github" | "gitlab" | "bitbucket" | "other";

const SAAS_ORIGIN: Record<Exclude<GitHost, "other">, string> = {
	github: "https://github.com",
	gitlab: "https://gitlab.com",
	bitbucket: "https://bitbucket.org",
};

// GitLab supports nested namespaces (group/subgroup/repo), so everything after the first
// path segment is the repo. GitHub/Bitbucket are always owner/repo.
function splitOwnerRepo(host: GitHost, parts: string[]): { owner: string; repo: string } {
	if (host === "gitlab") return { owner: parts[0] ?? "", repo: parts.slice(1).join("/") };
	return { owner: parts[0] ?? "", repo: parts[1] ?? "" };
}

export function parseGitUrl(
	gitUrl: string,
	provider: GitProvider = "auto",
): { host: GitHost; owner: string; repo: string; origin: string } {
	const trimmed = gitUrl.trim().replace(/\.git$/, "");

	// Shorthand owner/repo (no scheme) — only meaningful for a SaaS provider, which supplies
	// the origin. Defaults to GitHub when the provider isn't pinned.
	if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
		const host: GitHost = provider === "auto" ? "github" : provider;
		const [owner, repo] = trimmed.split("/");
		return { host, owner, repo, origin: SAAS_ORIGIN[host] };
	}

	try {
		const parsed = new URL(trimmed);
		const parts = parsed.pathname.replace(/^\//, "").split("/");

		// Explicit provider: trust the user's choice and derive the origin from the URL so
		// self-hosted instances (e.g. https://gitlab.example.com) target the right host.
		if (provider !== "auto") {
			const { owner, repo } = splitOwnerRepo(provider, parts);
			return { host: provider, owner, repo, origin: parsed.origin };
		}

		// Auto-detect: only the known SaaS hosts are recognized by exact hostname.
		if (parsed.hostname === "github.com") {
			const { owner, repo } = splitOwnerRepo("github", parts);
			return { host: "github", owner, repo, origin: parsed.origin };
		}
		if (parsed.hostname === "gitlab.com") {
			const { owner, repo } = splitOwnerRepo("gitlab", parts);
			return { host: "gitlab", owner, repo, origin: parsed.origin };
		}
		if (parsed.hostname === "bitbucket.org") {
			const { owner, repo } = splitOwnerRepo("bitbucket", parts);
			return { host: "bitbucket", owner, repo, origin: parsed.origin };
		}
	} catch {}
	return { host: "other", owner: "", repo: "", origin: "" };
}

/**
 * Build a browse URL pointing at <pluginPath>/skills/<skillSuffix> in the
 * marketplace's git repo. `pluginPath` comes from marketplace.json's
 * `plugins[].source` field (with the leading `./` stripped at sync time) and
 * may itself contain `/`. Returns null when the host is unknown or the inputs
 * are insufficient to construct a usable URL — we never guess the layout.
 */
export function buildSkillRepoUrl(
	gitUrl: string,
	branch: string | null,
	pluginPath: string,
	skillSuffix: string,
	provider: GitProvider = "auto",
): string | null {
	if (!pluginPath || !skillSuffix) return null;
	const { host, owner, repo, origin } = parseGitUrl(gitUrl, provider);
	if (host === "other" || !owner || !repo || !origin) return null;

	const ref = branch && branch.length > 0 ? branch : "HEAD";
	const refEncoded = encodeURIComponent(ref);
	const cleanedPluginPath = pluginPath.replace(/^\/+|\/+$/g, "");
	const pluginPathEncoded = cleanedPluginPath
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	const skill = encodeURIComponent(skillSuffix);
	const path = `${pluginPathEncoded}/skills/${skill}`;

	if (host === "github") {
		return `${origin}/${owner}/${repo}/tree/${refEncoded}/${path}`;
	}
	if (host === "gitlab") {
		return `${origin}/${owner}/${repo}/-/tree/${refEncoded}/${path}`;
	}
	if (host === "bitbucket") {
		return `${origin}/${owner}/${repo}/src/${refEncoded}/${path}`;
	}
	return null;
}
