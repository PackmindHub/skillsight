import { describe, expect, it } from "bun:test";
import type { ISkillRepository, MonthlyTrends } from "@/domain/ports/skill-repository";
import { getMonthlyTrends } from "./get-monthly-trends";

function makeDeps(getMonthlyTrendsImpl: () => Promise<MonthlyTrends>) {
	const calls: unknown[][] = [];

	const skills: ISkillRepository = {
		getTopSkills: async () => [],
		getDailyTrend: async () => [],
		getTopUsers: async () => [],
		getByTrigger: async () => [],
		getTotalActivations: async () => 0,
		getUniqueSkillsCount: async () => 0,
		getActiveUsersCount: async () => 0,
		getSkillsTable: async () => [],
		getSkillDetail: async () => null,
		getMonthlyTrends: async (...args: unknown[]) => {
			calls.push(args);
			return getMonthlyTrendsImpl();
		},
		upsertMany: async () => {},
		propagateStatusFromPlugins: async () => {},
		deleteByPlugins: async () => {},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
	};

	return { deps: { skills }, calls };
}

describe("getMonthlyTrends", () => {
	it("returns the repository result verbatim", async () => {
		const fixture: MonthlyTrends = {
			invocations: [
				{ month: "2026-03", count: 12 },
				{ month: "2026-04", count: 27 },
			],
			uniqueSkills: [
				{ month: "2026-03", count: 3 },
				{ month: "2026-04", count: 5 },
			],
			uniqueUsers: [
				{ month: "2026-03", count: 2 },
				{ month: "2026-04", count: 4 },
			],
		};
		const { deps } = makeDeps(async () => fixture);

		const result = await getMonthlyTrends(deps);

		expect(result).toEqual(fixture);
	});

	it("returns an empty-trends shape unchanged", async () => {
		const empty: MonthlyTrends = { invocations: [], uniqueSkills: [], uniqueUsers: [] };
		const { deps } = makeDeps(async () => empty);

		const result = await getMonthlyTrends(deps);

		expect(result).toEqual(empty);
	});

	it("calls the repository exactly once with no arguments", async () => {
		const { deps, calls } = makeDeps(async () => ({
			invocations: [],
			uniqueSkills: [],
			uniqueUsers: [],
		}));

		await getMonthlyTrends(deps);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([]);
	});

	it("propagates repository rejection", async () => {
		const { deps } = makeDeps(async () => {
			throw new Error("boom");
		});

		await expect(getMonthlyTrends(deps)).rejects.toThrow("boom");
	});
});
