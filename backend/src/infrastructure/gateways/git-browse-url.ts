export type GitHost = "github" | "gitlab" | "bitbucket" | "other";

export function parseGitUrl(gitUrl: string): { host: GitHost; owner: string; repo: string } {
	const trimmed = gitUrl.trim().replace(/\.git$/, "");
	if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
		const [owner, repo] = trimmed.split("/");
		return { host: "github", owner, repo };
	}
	try {
		const parsed = new URL(trimmed);
		const parts = parsed.pathname.replace(/^\//, "").split("/");
		if (parsed.hostname === "github.com")
			return { host: "github", owner: parts[0] ?? "", repo: parts[1] ?? "" };
		if (parsed.hostname === "gitlab.com")
			return { host: "gitlab", owner: parts[0] ?? "", repo: parts.slice(1).join("/") };
		if (parsed.hostname === "bitbucket.org")
			return { host: "bitbucket", owner: parts[0] ?? "", repo: parts[1] ?? "" };
	} catch {}
	return { host: "other", owner: "", repo: "" };
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
): string | null {
	if (!pluginPath || !skillSuffix) return null;
	const { host, owner, repo } = parseGitUrl(gitUrl);
	if (host === "other" || !owner || !repo) return null;

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
		return `https://github.com/${owner}/${repo}/tree/${refEncoded}/${path}`;
	}
	if (host === "gitlab") {
		return `https://gitlab.com/${owner}/${repo}/-/tree/${refEncoded}/${path}`;
	}
	if (host === "bitbucket") {
		return `https://bitbucket.org/${owner}/${repo}/src/${refEncoded}/${path}`;
	}
	return null;
}
