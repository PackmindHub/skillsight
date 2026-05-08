import { describe, expect, it } from "bun:test";
import { getSkillsTable } from "./get-skills-table";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { SkillTableRow } from "@/domain/skill";

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
		getMonthlyTrends: async () => ({ invocations: [], uniqueSkills: [], uniqueUsers: [] }),
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
	};
}

describe("getSkillsTable", () => {
	it("enriches a never-used row (total=0) with marketplace statuses from plugin marketplaces", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "linting",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					marketplaceNames: ["acme"],
					status: null,
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result).toHaveLength(1);
		expect(result[0].skillName).toBe("linting");
		expect(result[0].total).toBe(0);
		expect(result[0].marketplaces).toEqual([{ name: "acme", status: "approved" }]);
	});

	it("defaults unknown marketplaces to to_review", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "ghost-skill",
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
					marketplaceNames: ["mystery-mp"],
					status: null,
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
					skillSource: null,
					total: 0,
					userSlash: 0,
					claudeProactive: 0,
					nestedSkill: 0,
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

	it("passes through activated rows with their event-derived data", async () => {
		const deps = {
			skills: makeSkills([
				{
					skillName: "active-skill",
					skillSource: "bundled",
					total: 12,
					userSlash: 5,
					claudeProactive: 7,
					nestedSkill: 0,
					marketplaceNames: ["acme"],
					status: null,
				},
			]),
			marketplaces: makeMarketplaces([{ name: "acme", status: "approved" }]),
		};

		const result = await getSkillsTable(deps, { days: 30 });

		expect(result[0]).toEqual({
			skillName: "active-skill",
			skillSource: "bundled",
			total: 12,
			userSlash: 5,
			claudeProactive: 7,
			nestedSkill: 0,
			status: null,
			marketplaces: [{ name: "acme", status: "approved" }],
		});
	});
});
