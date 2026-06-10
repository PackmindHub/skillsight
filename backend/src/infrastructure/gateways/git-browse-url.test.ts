import { describe, expect, test } from "bun:test";
import { buildSkillRepoUrl, parseGitUrl } from "./git-browse-url";

describe("parseGitUrl", () => {
	test("github shorthand owner/repo", () => {
		expect(parseGitUrl("anthropics/claude-code")).toEqual({
			host: "github",
			owner: "anthropics",
			repo: "claude-code",
			origin: "https://github.com",
		});
	});

	test("github https url with .git suffix", () => {
		expect(parseGitUrl("https://github.com/anthropics/claude-code.git")).toEqual({
			host: "github",
			owner: "anthropics",
			repo: "claude-code",
			origin: "https://github.com",
		});
	});

	test("gitlab nested namespace", () => {
		expect(parseGitUrl("https://gitlab.com/group/sub/repo")).toEqual({
			host: "gitlab",
			owner: "group",
			repo: "sub/repo",
			origin: "https://gitlab.com",
		});
	});

	test("bitbucket workspace/repo", () => {
		expect(parseGitUrl("https://bitbucket.org/ws/repo")).toEqual({
			host: "bitbucket",
			owner: "ws",
			repo: "repo",
			origin: "https://bitbucket.org",
		});
	});

	test("unknown host falls back to other (auto)", () => {
		expect(parseGitUrl("https://git.example.com/foo/bar")).toEqual({
			host: "other",
			owner: "",
			repo: "",
			origin: "",
		});
	});

	test("invalid URL string falls back to other", () => {
		expect(parseGitUrl("not a url")).toEqual({ host: "other", owner: "", repo: "", origin: "" });
	});

	test("explicit gitlab provider recognizes a self-hosted host and derives the origin", () => {
		expect(parseGitUrl("https://gitlab.example.com/group/sub/repo", "gitlab")).toEqual({
			host: "gitlab",
			owner: "group",
			repo: "sub/repo",
			origin: "https://gitlab.example.com",
		});
	});

	test("explicit gitlab provider keeps the port in the origin", () => {
		expect(parseGitUrl("https://git.company.com:8443/team/app", "gitlab")).toEqual({
			host: "gitlab",
			owner: "team",
			repo: "app",
			origin: "https://git.company.com:8443",
		});
	});

	test("explicit github provider on a non-github host still splits owner/repo", () => {
		expect(parseGitUrl("https://ghe.example.com/org/repo", "github")).toEqual({
			host: "github",
			owner: "org",
			repo: "repo",
			origin: "https://ghe.example.com",
		});
	});
});

describe("buildSkillRepoUrl", () => {
	test("github with explicit branch and standard plugins/<name> layout", () => {
		expect(
			buildSkillRepoUrl(
				"https://github.com/anthropics/claude-code",
				"main",
				"plugins/claude-md-management",
				"revise-claude-md",
			),
		).toBe(
			"https://github.com/anthropics/claude-code/tree/main/plugins/claude-md-management/skills/revise-claude-md",
		);
	});

	test("github shorthand with non-standard plugin path (impeccable case)", () => {
		expect(
			buildSkillRepoUrl("pbakaus/impeccable", "main", "plugin", "impeccable"),
		).toBe("https://github.com/pbakaus/impeccable/tree/main/plugin/skills/impeccable");
	});

	test("nested plugin path is preserved without re-encoding the /", () => {
		expect(
			buildSkillRepoUrl(
				"https://github.com/o/r",
				"main",
				"packages/plugin-a",
				"my-skill",
			),
		).toBe("https://github.com/o/r/tree/main/packages/plugin-a/skills/my-skill");
	});

	test("null branch falls back to HEAD", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r", null, "plugin", "s"),
		).toBe("https://github.com/o/r/tree/HEAD/plugin/skills/s");
	});

	test("empty branch string falls back to HEAD", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r", "", "plugin", "s"),
		).toBe("https://github.com/o/r/tree/HEAD/plugin/skills/s");
	});

	test("gitlab uses /-/tree/ prefix and preserves nested namespace", () => {
		expect(
			buildSkillRepoUrl(
				"https://gitlab.com/group/sub/repo",
				"main",
				"plugin",
				"s",
			),
		).toBe("https://gitlab.com/group/sub/repo/-/tree/main/plugin/skills/s");
	});

	test("self-hosted gitlab (explicit provider) builds a browse URL on the right origin", () => {
		expect(
			buildSkillRepoUrl(
				"https://gitlab.example.com/group/sub/repo",
				"main",
				"plugin",
				"s",
				"gitlab",
			),
		).toBe("https://gitlab.example.com/group/sub/repo/-/tree/main/plugin/skills/s");
	});

	test("bitbucket uses /src/", () => {
		expect(
			buildSkillRepoUrl("https://bitbucket.org/ws/repo", "main", "plugin", "s"),
		).toBe("https://bitbucket.org/ws/repo/src/main/plugin/skills/s");
	});

	test("returns null for unknown host", () => {
		expect(
			buildSkillRepoUrl("https://git.example.com/o/r", "main", "plugin", "s"),
		).toBeNull();
	});

	test("returns null when skillSuffix is empty", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r", "main", "plugin", ""),
		).toBeNull();
	});

	test("returns null when pluginPath is empty", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r", "main", "", "s"),
		).toBeNull();
	});

	test("escapes special characters in path segments", () => {
		expect(
			buildSkillRepoUrl(
				"https://github.com/o/r",
				"main",
				"my plugin",
				"skill with space",
			),
		).toBe("https://github.com/o/r/tree/main/my%20plugin/skills/skill%20with%20space");
	});

	test("strips leading/trailing slashes from pluginPath", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r", "main", "/plugin/", "s"),
		).toBe("https://github.com/o/r/tree/main/plugin/skills/s");
	});

	test("strips .git suffix from gitUrl", () => {
		expect(
			buildSkillRepoUrl("https://github.com/o/r.git", "main", "plugin", "s"),
		).toBe("https://github.com/o/r/tree/main/plugin/skills/s");
	});
});
