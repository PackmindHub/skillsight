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
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "to_review",
					lastSeenAt: null,
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
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["mystery-mp"],
					status: "to_review",
					lastSeenAt: null,
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
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "removed",
					lastSeenAt: null,
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
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "approved",
					lastSeenAt: null,
				},
				{
					skillName: "review-skill",
					pluginName: "p/b",
					skillSource: null,
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "to_review",
					lastSeenAt: null,
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
					skillSource: "external",
					total: 12,
					uniqueUsers: 4,
					userSlash: 5,
					claudeProactive: 7,
					nestedSkill: 0,
					dailyCounts: [1, 2, 3, 1, 0, 2, 3],
					marketplaceNames: ["acme"],
					status: "to_review",
					lastSeenAt: "2026-05-10T12:00:00.000Z",
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0]).toEqual({
			skillName: "active-skill",
			pluginName: "acme/lint",
			skillSource: "external",
			total: 12,
			uniqueUsers: 4,
			userSlash: 5,
			claudeProactive: 7,
			nestedSkill: 0,
			dailyCounts: [1, 2, 3, 1, 0, 2, 3],
			status: "to_review",
			marketplaces: [{ name: "acme", status: "approved" }],
			lastSeenAt: "2026-05-10T12:00:00.000Z",
		});
	});

	it("defaults bundled skills with a to_review stored status to approved", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "update-config",
					pluginName: null,
					skillSource: "bundled",
					total: 3,
					uniqueUsers: 1,
					userSlash: 3,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [1, 1, 1],
					marketplaceNames: [],
					status: "to_review",
					lastSeenAt: "2026-05-10T12:00:00.000Z",
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0].status).toBe("approved");
	});

	it("preserves explicit non-to_review statuses on bundled skills", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "approved-bundled",
					pluginName: null,
					skillSource: "bundled",
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "approved",
					lastSeenAt: null,
				},
				{
					skillName: "removed-bundled",
					pluginName: null,
					skillSource: "bundled",
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "removed",
					lastSeenAt: null,
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result.find((r) => r.skillName === "approved-bundled")?.status).toBe("approved");
		expect(result.find((r) => r.skillName === "removed-bundled")?.status).toBe("removed");
	});

	it("forwards lastSeenAt from the repository (or null for never-used rows)", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "recent",
					pluginName: "p/a",
					skillSource: null,
					total: 1,
					uniqueUsers: 1,
					userSlash: 1,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [1],
					marketplaceNames: [],
					status: "to_review",
					lastSeenAt: "2026-05-01T00:00:00.000Z",
				},
				{
					skillName: "never",
					pluginName: "p/b",
					skillSource: null,
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: [],
					status: "to_review",
					lastSeenAt: null,
				},
			]),
			marketplaces: makeMarketplaces([]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result.find((r) => r.skillName === "recent")?.lastSeenAt).toBe(
			"2026-05-01T00:00:00.000Z",
		);
		expect(result.find((r) => r.skillName === "never")?.lastSeenAt).toBeNull();
	});

	it("returns one row per (skill, plugin) when the same skill appears in multiple plugins", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "review",
					pluginName: "alpha/tools",
					skillSource: null,
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "to_review",
					lastSeenAt: null,
				},
				{
					skillName: "review",
					pluginName: "beta/tools",
					skillSource: null,
					total: 0,
					uniqueUsers: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [],
					marketplaceNames: ["acme"],
					status: "to_review",
					lastSeenAt: null,
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
					uniqueUsers: 2,
					userSlash: 3,
					claudeProactive: 0,
					nestedSkill: 0,
					dailyCounts: [1, 1, 1],
					marketplaceNames: [],
					status: "to_review",
					lastSeenAt: null,
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
