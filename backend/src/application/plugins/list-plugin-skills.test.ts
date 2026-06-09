import { describe, expect, it } from "bun:test";
import type {
	PluginSkillActivation,
	PluginUserActivation,
	PluginVersionRow,
	PluginWeeklyLoaders,
} from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import { listPluginSkills } from "./list-plugin-skills";

function makeDeps(opts: {
	skills?: PluginSkillActivation[];
	topUsers?: PluginUserActivation[];
	versions?: PluginVersionRow[];
	weeklyLoaders?: PluginWeeklyLoaders;
}) {
	const weeklyLoaderCalls: unknown[][] = [];
	const plugins: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => opts.skills ?? [],
		listTopUsers: async () => opts.topUsers ?? [],
		findByName: async () => null,
		upsert: async () => {},
		upsertIfAbsent: async () => {},
		update: async () => null,
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async () => [],
		reactivateRemovedByMarketplace: async () => [],
		listNamesByMarketplace: async () => [],
		orphanByMarketplace: async () => [],
		deleteByMarketplace: async () => [],
		getLoadStats: async () => ({ totalLoads: 0, uniqueLoadedPlugins: 0, uniqueLoaders: 0 }),
		getWeeklyLoadersByVersion: async (...args: unknown[]) => {
			weeklyLoaderCalls.push(args);
			return opts.weeklyLoaders ?? { weeks: [], versions: [] };
		},
	};
	const pluginVersions: IPluginVersionRepository = {
		upsertSeen: async () => {},
		listForPlugin: async () => opts.versions ?? [],
		listVersionStrings: async () => [],
	};
	return { deps: { plugins, pluginVersions }, weeklyLoaderCalls };
}

describe("listPluginSkills", () => {
	it("defaults pluginIdHash to null for a cataloged plugin", async () => {
		const { deps, weeklyLoaderCalls } = makeDeps({});

		await listPluginSkills(deps, "my-plugin", "acme");

		// Third arg (pluginIdHash) is null so the repo matches on (name, marketplace).
		expect(weeklyLoaderCalls).toEqual([["my-plugin", "acme", null]]);
	});

	it("forwards pluginIdHash so a redacted third-party row resolves its load chart by hash", async () => {
		const { deps, weeklyLoaderCalls } = makeDeps({});

		await listPluginSkills(deps, "third-party", null, "abc123");

		expect(weeklyLoaderCalls).toEqual([["third-party", null, "abc123"]]);
	});

	it("derives latestVersion from the version list via semver-max", async () => {
		const { deps } = makeDeps({
			versions: [
				{
					version: "1.2.0",
					firstSeenAt: new Date(0),
					lastSeenAt: new Date(0),
					loadCount: 1,
					uniqueLoaderCount: 1,
				},
				{
					version: "1.10.0",
					firstSeenAt: new Date(0),
					lastSeenAt: new Date(0),
					loadCount: 1,
					uniqueLoaderCount: 1,
				},
			],
		});

		const result = await listPluginSkills(deps, "my-plugin", "acme");

		expect(result.latestVersion).toBe("1.10.0");
	});
});
