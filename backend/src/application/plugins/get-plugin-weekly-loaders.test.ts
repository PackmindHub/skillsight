import { describe, expect, it } from "bun:test";
import type { PluginWeeklyLoaders } from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import { getPluginWeeklyLoaders } from "./get-plugin-weekly-loaders";

function makeDeps(impl: () => Promise<PluginWeeklyLoaders>) {
	const calls: unknown[][] = [];
	const plugins: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => [],
		listTopUsers: async () => [],
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
			calls.push(args);
			return impl();
		},
	};
	return { deps: { plugins }, calls };
}

describe("getPluginWeeklyLoaders", () => {
	it("forwards plugin name and marketplace name to the repository", async () => {
		const fixture: PluginWeeklyLoaders = {
			weeks: [
				{ weekStart: "2026-03-02", total: 4, perVersion: { "1.0.0": 4 } },
				{ weekStart: "2026-03-09", total: 7, perVersion: { "1.0.0": 5, "1.1.0": 3 } },
			],
			versions: ["1.0.0", "1.1.0"],
		};
		const { deps, calls } = makeDeps(async () => fixture);

		const result = await getPluginWeeklyLoaders(deps, {
			pluginName: "my-plugin",
			marketplaceName: "acme",
		});

		expect(result).toEqual(fixture);
		expect(calls).toEqual([["my-plugin", "acme"]]);
	});

	it("passes a null marketplace through unchanged", async () => {
		const { deps, calls } = makeDeps(async () => ({ weeks: [], versions: [] }));

		await getPluginWeeklyLoaders(deps, { pluginName: "p", marketplaceName: null });

		expect(calls).toEqual([["p", null]]);
	});

	it("propagates repository rejection", async () => {
		const { deps } = makeDeps(async () => {
			throw new Error("boom");
		});

		await expect(
			getPluginWeeklyLoaders(deps, { pluginName: "p", marketplaceName: null }),
		).rejects.toThrow("boom");
	});
});
