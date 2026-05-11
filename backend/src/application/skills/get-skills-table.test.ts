import { describe, expect, it } from "bun:test";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { SkillTableRow } from "@/domain/skill";
import { getSkillsTable } from "./get-skills-table";

function makeSkills(rows: SkillTableRow[]): ISkillRepository {
	return {
		getTopSkills: async () => [],
		getDailyTrend: async () => [],
		getTopUsers: async () => [],
		getByTrigger: async () => [],
		getTotalActivations: async () => 0,
		getUniqueSkillsCount: async () => 0,
		getActiveUsersCount: async () => 0,
		getSkillsTable: async () => rows,
		getSkillDetail: async () => null,
		getMonthlyTrends: async () => ({ invocations: [], uniqueSkills: [], uniqueUsers: [] }),
		upsertMany: async () => {},
		propagateStatusFromPlugins: async () => {},
		deleteByPlugins: async () => {},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
	};
}

function makeMarketplaces(
	statuses: Array<{ name: string; status: "to_review" | "approved" | "denied" }>,
): IMarketplaceRepository {
	return {
		listWithStats: async () => [],
		findByName: async () => null,
		update: async () => ({
			name: "x",
			status: "approved",
			url: null,
			description: null,
			firstSeenAt: new Date(),
			lastSeenAt: new Date(),
		}),
		upsertSeen: async () => {},
		upsertFromImport: async () => {},
		listStatuses: async () => statuses,
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
}

describe("getSkillsTable", () => {
	it("enriches a never-used row (total=0) with marketplace statuses from plugin marketplaces", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "linting",
					pluginName: "acme/lint",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "unknown",
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result).toHaveLength(1);
		expect(result[0].skillName).toBe("linting");
		expect(result[0].pluginName).toBe("acme/lint");
		expect(result[0].total).toBe(0);
		expect(result[0].marketplaces).toEqual([{ name: "acme", status: "approved" }]);
	});

	it("defaults unknown marketplaces to to_review", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "ghost-skill",
					pluginName: null,
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["mystery-mp"],
					status: "unknown",
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0].marketplaces).toEqual([{ name: "mystery-mp", status: "to_review" }]);
	});

	it("preserves removed status on a never-used row", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "old-skill",
					pluginName: "legacy/foo",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "removed",
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0].status).toBe("removed");
		expect(result[0].marketplaces).toEqual([]);
	});

	it("preserves approved and to_review statuses", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "approved-skill",
					pluginName: "p/a",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "approved",
				},
				{
					skillName: "review-skill",
					pluginName: "p/b",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "to_review",
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result.find((r) => r.skillName === "approved-skill")?.status).toBe("approved");
		expect(result.find((r) => r.skillName === "review-skill")?.status).toBe("to_review");
	});

	it("passes through activated rows with their event-derived data", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "active-skill",
					pluginName: "acme/lint",
					skillSource: "bundled",
					total: 12,
					userSlash: 5,
					claudeProactive: 7,
					nestedSkill: 0,
					dailyCounts: [1, 2, 3, 1, 0, 2, 3],
					marketplaceNames: ["acme"],
					status: "unknown",
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0]).toEqual({
			skillName: "active-skill",
			pluginName: "acme/lint",
			skillSource: "bundled",
			total: 12,
			userSlash: 5,
			claudeProactive: 7,
			nestedSkill: 0,
			dailyCounts: [1, 2, 3, 1, 0, 2, 3],
			status: "unknown",
			marketplaces: [{ name: "acme", status: "approved" }],
		});
	});

	it("returns one row per (skill, plugin) when the same skill appears in multiple plugins", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "review",
					pluginName: "alpha/tools",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "unknown",
				},
				{
					skillName: "review",
					pluginName: "beta/tools",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "unknown",
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result).toHaveLength(2);
		expect(result.map((r) => r.pluginName).sort()).toEqual(["alpha/tools", "beta/tools"]);
		for (const row of result) {
			expect(row.skillName).toBe("review");
			expect(row.marketplaces).toEqual([{ name: "acme", status: "approved" }]);
		}
	});

	it("handles orphan rows (event-only skills) with pluginName=null", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "phantom",
					pluginName: null,
					skillSource: null,
					total: 3,
					userSlash: 3,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [1, 1, 1],
					marketplaceNames: [],
					status: "unknown",
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result).toHaveLength(1);
		expect(result[0].pluginName).toBeNull();
		expect(result[0].marketplaces).toEqual([]);
		expect(result[0].total).toBe(3);
	});
});
