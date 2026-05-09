import { describe, expect, it } from "bun:test";
import type { MarketplaceStatus } from "@/domain/marketplace";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { SkillStatus } from "@/domain/skill";
import { syncPluginStatuses } from "./sync-plugin-statuses";

function makePlugins(namesByMarketplace: Record<string, string[]> = {}) {
	const updateCalls: Array<{ marketplaceName: string; status: string }> = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		upsert: async () => {},
		updateStatusByMarketplace: async (marketplaceName, status) => {
			updateCalls.push({ marketplaceName, status });
		},
		markRemovedByMarketplace: async () => [],
		listNamesByMarketplace: async (name) => namesByMarketplace[name] ?? [],
	};
	return { repo, updateCalls };
}

function makeSkills() {
	const propagateCalls: Array<{ pluginNames: string[]; status: SkillStatus }> = [];
	const repo: ISkillRepository = {
		getTopSkills: async () => [],
		getDailyTrend: async () => [],
		getTopUsers: async () => [],
		getByTrigger: async () => [],
		getTotalActivations: async () => 0,
		getUniqueSkillsCount: async () => 0,
		getActiveUsersCount: async () => 0,
		getSkillsTable: async () => [],
		getSkillDetail: async () => null,
		getMonthlyTrends: async () => ({ invocations: [], uniqueSkills: [], uniqueUsers: [] }),
		upsertMany: async () => {},
		propagateStatusFromPlugins: async (pluginNames, status) => {
			propagateCalls.push({ pluginNames, status });
		},
	};
	return { repo, propagateCalls };
}

describe("syncPluginStatuses", () => {
	it("updates plugin statuses then propagates to skills exclusively linked to those plugins", async () => {
		const { repo: plugins, updateCalls } = makePlugins({
			"acme-mp": ["plugin-a", "plugin-b"],
		});
		const { repo: skills, propagateCalls } = makeSkills();

		await syncPluginStatuses({ plugins, skills }, "acme-mp", "approved" as MarketplaceStatus);

		expect(updateCalls).toHaveLength(1);
		expect(updateCalls[0].marketplaceName).toBe("acme-mp");
		expect(updateCalls[0].status).toBe("approved");

		expect(propagateCalls).toHaveLength(1);
		expect(propagateCalls[0].pluginNames).toEqual(["plugin-a", "plugin-b"]);
		expect(propagateCalls[0].status).toBe("approved");
	});

	it("propagates 'to_review' when marketplace becomes denied (matches computePluginStatus)", async () => {
		const { repo: plugins } = makePlugins({ "acme-mp": ["plugin-a"] });
		const { repo: skills, propagateCalls } = makeSkills();

		await syncPluginStatuses({ plugins, skills }, "acme-mp", "denied" as MarketplaceStatus);

		expect(propagateCalls[0].status).toBe("to_review");
		expect(propagateCalls[0].pluginNames).toEqual(["plugin-a"]);
	});

	it("calls propagation with empty array when marketplace has no plugins", async () => {
		const { repo: plugins } = makePlugins({ "empty-mp": [] });
		const { repo: skills, propagateCalls } = makeSkills();

		await syncPluginStatuses({ plugins, skills }, "empty-mp", "approved" as MarketplaceStatus);

		expect(propagateCalls).toHaveLength(1);
		expect(propagateCalls[0].pluginNames).toEqual([]);
	});
});
