import { describe, expect, it } from "bun:test";
import type { ExternalSkillPluginMapping } from "@/domain/external-skill-mapping";
import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";
import { ExternalSkillMappingCache } from "./mapping-cache";

function makeRepo(initial: Array<Pick<ExternalSkillPluginMapping, "skillName" | "pluginName" | "marketplaceName">>) {
	let current = initial;
	const repo: IExternalSkillPluginMappingRepository = {
		findAll: async () =>
			current.map((r) => ({
				skillName: r.skillName,
				pluginName: r.pluginName,
				marketplaceName: r.marketplaceName,
				sourceId: "src",
				syncedAt: new Date(),
			})),
		findByName: async () => null,
		upsertMany: async () => {},
		deleteBySourceId: async () => {},
		deleteMissingForSource: async () => {},
	};
	const swap = (next: typeof initial) => {
		current = next;
	};
	return { repo, swap };
}

describe("ExternalSkillMappingCache", () => {
	it("starts empty and reports not loaded", () => {
		const { repo } = makeRepo([]);
		const cache = new ExternalSkillMappingCache(repo);
		expect(cache.size()).toBe(0);
		expect(cache.isLoaded()).toBe(false);
		expect(cache.lookup("anything")).toBeUndefined();
	});

	it("load() populates the lookup map", async () => {
		const { repo } = makeRepo([
			{ skillName: "hex-arch", pluginName: "@backend/generic", marketplaceName: "Packmind" },
			{ skillName: "lint", pluginName: "@global/quality", marketplaceName: "Packmind" },
		]);
		const cache = new ExternalSkillMappingCache(repo);
		await cache.load();
		expect(cache.size()).toBe(2);
		expect(cache.isLoaded()).toBe(true);
		expect(cache.lookup("hex-arch")).toEqual({
			pluginName: "@backend/generic",
			marketplaceName: "Packmind",
		});
		expect(cache.lookup("lint")).toEqual({
			pluginName: "@global/quality",
			marketplaceName: "Packmind",
		});
		expect(cache.lookup("unknown")).toBeUndefined();
	});

	it("refresh() reflects new repo state and drops stale entries", async () => {
		const { repo, swap } = makeRepo([
			{ skillName: "hex-arch", pluginName: "@backend/generic", marketplaceName: "Packmind" },
		]);
		const cache = new ExternalSkillMappingCache(repo);
		await cache.load();
		expect(cache.lookup("hex-arch")).toBeDefined();

		swap([{ skillName: "qa-review", pluginName: "@global/generic", marketplaceName: "Packmind" }]);
		await cache.refresh();

		expect(cache.lookup("hex-arch")).toBeUndefined();
		expect(cache.lookup("qa-review")).toEqual({
			pluginName: "@global/generic",
			marketplaceName: "Packmind",
		});
	});
});
