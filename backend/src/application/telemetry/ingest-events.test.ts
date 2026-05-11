import { describe, expect, it } from "bun:test";
import { EVENT_NAMES } from "@/domain/event";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type {
	ISkillRepository,
	SkillUpsertEntry,
} from "@/domain/ports/skill-repository";
import { ingestEvents } from "./ingest-events";

function makeEvents(): IEventRepository {
	return {
		insertMany: async () => {},
		deleteByIntegrationId: async () => {},
		deleteBySkillKeys: async () => 0,
		listRecentSkillActivations: async () => [],
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
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
}

function makeMarketplacesWithCapture() {
	const upsertSeenCalls: string[][] = [];
	const repo: IMarketplaceRepository = {
		listWithStats: async () => [],
		findByName: async () => null,
		update: async () => {
			throw new Error("not used");
		},
		upsertSeen: async (names) => {
			upsertSeenCalls.push(names);
		},
		upsertFromImport: async () => {},
		listStatuses: async () => [],
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
	return { repo, upsertSeenCalls };
}

function makePlugins() {
	const upsertCalls: Array<{ pluginName: string; marketplaceName: string | null }> = [];
	const upsertIfAbsentCalls: Array<{ pluginName: string; marketplaceName: string | null }> = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => [],
		listTopUsers: async () => [],
		upsert: async (p) => {
			upsertCalls.push({ pluginName: p.pluginName, marketplaceName: p.marketplaceName });
		},
		upsertIfAbsent: async (p) => {
			upsertIfAbsentCalls.push({ pluginName: p.pluginName, marketplaceName: p.marketplaceName });
		},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async () => [],
		listNamesByMarketplace: async () => [],
	};
	return { repo, upsertCalls, upsertIfAbsentCalls };
}

function makePluginSkills() {
	const upsertManyCalls: Array<Array<{ pluginName: string; skillName: string }>> = [];
	const repo: IPluginSkillRepository = {
		upsertMany: async (entries) => {
			upsertManyCalls.push(entries);
		},
	};
	return { repo, upsertManyCalls };
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
		deleteByPlugins: async () => {},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
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
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "lint", "plugin.name": "plugin-a" },
				},
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
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
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
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
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{ eventName: EVENT_NAMES.SKILL_ACTIVATED, attrs: { "plugin.name": "x" } },
				{ eventName: EVENT_NAMES.SKILL_ACTIVATED, attrs: { "skill.name": "y" } },
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([{ skillName: "y", pluginName: null }]);
	});

	it("does not call skills.upsertMany when no skill_activated events are received", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{ eventName: EVENT_NAMES.PLUGIN_INSTALLED, attrs: { "plugin.name": "x" } },
			]),
		);

		expect(upsertManyCalls).toHaveLength(0);
	});
});

describe("ingestEvents — plugin auto-creation from skill_activated", () => {
	it("creates plugin (upsertIfAbsent) and plugin_skills link when skill_activated carries plugin.name", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertCalls, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillsCalls } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "commit", "plugin.name": "John" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([{ pluginName: "John", marketplaceName: null }]);
		expect(upsertCalls).toEqual([]);
		expect(pluginSkillsCalls).toHaveLength(1);
		expect(pluginSkillsCalls[0]).toEqual([{ pluginName: "John", skillName: "commit" }]);
	});

	it("does not touch plugins/plugin_skills when skill_activated has no plugin.name", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertCalls, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillsCalls } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "commit" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([]);
		expect(upsertCalls).toEqual([]);
		expect(pluginSkillsCalls).toEqual([]);
	});

	it("dedupes plugin upsertIfAbsent calls but records every (plugin, skill) pair", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillsCalls } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "commit", "plugin.name": "John" },
				},
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "review", "plugin.name": "John" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toHaveLength(1);
		expect(upsertIfAbsentCalls[0]).toEqual({ pluginName: "John", marketplaceName: null });
		expect(pluginSkillsCalls).toHaveLength(1);
		expect(pluginSkillsCalls[0]).toEqual([
			{ pluginName: "John", skillName: "commit" },
			{ pluginName: "John", skillName: "review" },
		]);
	});

	it("uses upsert (not upsertIfAbsent) when a plugin_installed event arrives for the same plugin", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertCalls, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "commit", "plugin.name": "John" },
				},
				{
					eventName: EVENT_NAMES.PLUGIN_INSTALLED,
					attrs: { "plugin.name": "John", "plugin.version": "1.2.3" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([{ pluginName: "John", marketplaceName: null }]);
		expect(upsertCalls).toEqual([{ pluginName: "John", marketplaceName: null }]);
	});
});

describe("ingestEvents — 'inline' marketplace normalization", () => {
	it("normalizes 'inline' to null on skill_activated and skips marketplace upsert", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: marketplaces, upsertSeenCalls } = makeMarketplacesWithCapture();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces,
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: {
						"skill.name": "format",
						"plugin.name": "local-plugin",
						"marketplace.name": "inline",
					},
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([
			{ pluginName: "local-plugin", marketplaceName: null },
		]);
		expect(upsertSeenCalls).toEqual([]);
	});

	it("normalizes 'inline' to null on plugin_installed", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: marketplaces, upsertSeenCalls } = makeMarketplacesWithCapture();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces,
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_INSTALLED,
					attrs: {
						"plugin.name": "local-plugin",
						"marketplace.name": "inline",
						"plugin.version": "0.1.0",
					},
				},
			]),
		);

		expect(upsertCalls).toEqual([
			{ pluginName: "local-plugin", marketplaceName: null },
		]);
		expect(upsertSeenCalls).toEqual([]);
	});

	it("upserts real marketplaces but drops 'inline' from the same batch", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: marketplaces, upsertSeenCalls } = makeMarketplacesWithCapture();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces,
				plugins,
				pluginSkills,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: {
						"skill.name": "a",
						"plugin.name": "p1",
						"marketplace.name": "official",
					},
				},
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: {
						"skill.name": "b",
						"plugin.name": "p2",
						"marketplace.name": "inline",
					},
				},
			]),
		);

		expect(upsertSeenCalls).toHaveLength(1);
		expect(upsertSeenCalls[0]).toEqual(["official"]);
	});
});
