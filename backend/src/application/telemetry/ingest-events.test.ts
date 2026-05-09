import { describe, expect, it } from "bun:test";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type {
	ISkillRepository,
	SkillUpsertEntry,
} from "@/domain/ports/skill-repository";
import { ingestEvents } from "./ingest-events";

function makeEvents(): IEventRepository {
	return {
		insertMany: async () => {},
		deleteByIntegrationId: async () => {},
	};
}

function makeMarketplaces(): IMarketplaceRepository {
	return {
		listWithStats: async () => [],
		findByName: async () => null,
		update: async () => {
			throw new Error("not used");
		},
		upsertSeen: async () => {},
		upsertFromImport: async () => {},
		listStatuses: async () => [],
	};
}

function makePlugins() {
	const upsertCalls: Array<{ pluginName: string; marketplaceName: string | null }> = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		upsert: async (p) => {
			upsertCalls.push({ pluginName: p.pluginName, marketplaceName: p.marketplaceName });
		},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async () => [],
		listNamesByMarketplace: async () => [],
	};
	return { repo, upsertCalls };
}

function makeSkills() {
	const upsertManyCalls: SkillUpsertEntry[][] = [];
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
		upsertMany: async (entries) => {
			upsertManyCalls.push(entries);
		},
		propagateStatusFromPlugins: async () => {},
	};
	return { repo, upsertManyCalls };
}

function otlpBody(records: Array<{ eventName: string; attrs?: Record<string, string> }>) {
	return {
		resourceLogs: [
			{
				resource: { attributes: [] },
				scopeLogs: [
					{
						logRecords: records.map((r) => ({
							timeUnixNano: "1700000000000000000",
							body: { stringValue: "" },
							attributes: [
								{ key: "event.name", value: { stringValue: r.eventName } },
								...Object.entries(r.attrs ?? {}).map(([k, v]) => ({
									key: k,
									value: { stringValue: v },
								})),
							],
						})),
					},
				],
			},
		],
	};
}

describe("ingestEvents — skills upsert", () => {
	it("upserts (skillName, pluginName) tuples for skill_activated events", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();

		await ingestEvents(
			{ events: makeEvents(), marketplaces: makeMarketplaces(), plugins, skills },
			otlpBody([
				{
					eventName: "claude_code.skill_activated",
					attrs: { "skill.name": "lint", "plugin.name": "plugin-a" },
				},
				{
					eventName: "claude_code.skill_activated",
					attrs: { "skill.name": "lint", "plugin.name": "plugin-b" },
				},
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([
			{ skillName: "lint", pluginName: "plugin-a" },
			{ skillName: "lint", pluginName: "plugin-b" },
		]);
	});

	it("upserts skill with pluginName=null when plugin.name attribute is absent", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();

		await ingestEvents(
			{ events: makeEvents(), marketplaces: makeMarketplaces(), plugins, skills },
			otlpBody([
				{
					eventName: "claude_code.skill_activated",
					attrs: { "skill.name": "format" },
				},
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([{ skillName: "format", pluginName: null }]);
	});

	it("ignores skill_activated events with no skill.name", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();

		await ingestEvents(
			{ events: makeEvents(), marketplaces: makeMarketplaces(), plugins, skills },
			otlpBody([
				{ eventName: "claude_code.skill_activated", attrs: { "plugin.name": "x" } },
				{ eventName: "claude_code.skill_activated", attrs: { "skill.name": "y" } },
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([{ skillName: "y", pluginName: null }]);
	});

	it("does not call skills.upsertMany when no skill_activated events are received", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();

		await ingestEvents(
			{ events: makeEvents(), marketplaces: makeMarketplaces(), plugins, skills },
			otlpBody([
				{ eventName: "claude_code.plugin_installed", attrs: { "plugin.name": "x" } },
			]),
		);

		expect(upsertManyCalls).toHaveLength(0);
	});
});
