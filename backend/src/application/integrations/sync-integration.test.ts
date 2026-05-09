import { describe, expect, it } from "bun:test";
import type { NewEvent } from "@/domain/event";
import type { IntegrationWithSecret } from "@/domain/integration";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type {
	ISkillRepository,
	SkillUpsertEntry,
} from "@/domain/ports/skill-repository";
import { syncIntegration } from "./sync-integration";

function makeAudit(): IAuditRepository {
	return {
		log: async () => {},
		list: async () => ({ items: [], total: 0 }),
		listAll: async () => [],
	};
}

const BASE_INTEGRATION: IntegrationWithSecret = {
	id: "i-1",
	type: "loki",
	name: "Loki",
	url: "http://loki:3100",
	authType: "none",
	authUsername: null,
	authPasswordEncrypted: null,
	hasPassword: false,
	lokiQuery: "{service_name=\"claude-code\"}",
	syncIntervalMs: 30000,
	enabled: true,
	lastSyncAt: null,
	lastSyncError: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function makeIntegrations(): IIntegrationRepository {
	return {
		findAll: async () => [],
		findById: async () => null,
		create: async () => BASE_INTEGRATION,
		update: async () => BASE_INTEGRATION,
		delete: async () => {},
		updateSyncStatus: async () => {},
		countEventsByIntegration: async () => new Map(),
	};
}

function makeEvents() {
	const inserted: NewEvent[][] = [];
	const repo: IEventRepository = {
		insertMany: async (events) => {
			inserted.push(events);
		},
		listRecent: async () => [],
		countByIntegration: async () => 0,
		deleteByIntegrationId: async () => 0,
	} as unknown as IEventRepository;
	return { repo, inserted };
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

function makePlugins() {
	const upsertCalls: Array<{ pluginName: string; marketplaceName: string | null }> = [];
	const upsertIfAbsentCalls: Array<{ pluginName: string; marketplaceName: string | null }> = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => [],
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

function makeLoki(streams: LokiStreamResult[]): ILokiGateway {
	return {
		fetchLogs: async () => streams,
	};
}

function streamWithEvent(eventName: string, attrs: Record<string, string>): LokiStreamResult {
	const body = {
		resourceLogs: [
			{
				scopeLogs: [
					{
						logRecords: [
							{
								timeUnixNano: "1700000000000000000",
								body: { stringValue: "" },
								attributes: [
									{ key: "event.name", value: { stringValue: eventName } },
									...Object.entries(attrs).map(([k, v]) => ({
										key: k,
										value: { stringValue: v },
									})),
								],
							},
						],
					},
				],
			},
		],
	};
	return {
		stream: {},
		values: [["1700000000000000000", JSON.stringify(body)]],
	};
}

describe("syncIntegration", () => {
	it("upserts (skillName, pluginName) tuples for skill_activated events", async () => {
		const { repo: integrations } = { repo: makeIntegrations() };
		const { repo: events } = makeEvents();
		const { repo: skills, upsertManyCalls } = makeSkills();

		const loki = makeLoki([
			streamWithEvent("claude_code.skill_activated", {
				"skill.name": "lint",
				"plugin.name": "plugin-a",
			}),
		]);

		await syncIntegration(
			{
				integrations,
				events,
				skills,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkills().repo,
				marketplaces: makeMarketplaces(),
				loki,
				audit: makeAudit(),
			},
			BASE_INTEGRATION,
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([{ skillName: "lint", pluginName: "plugin-a" }]);
	});

	it("upserts skill with pluginName=null when plugin.name attribute is absent", async () => {
		const { repo: integrations } = { repo: makeIntegrations() };
		const { repo: events } = makeEvents();
		const { repo: skills, upsertManyCalls } = makeSkills();

		const loki = makeLoki([
			streamWithEvent("claude_code.skill_activated", { "skill.name": "format" }),
		]);

		await syncIntegration(
			{
				integrations,
				events,
				skills,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkills().repo,
				marketplaces: makeMarketplaces(),
				loki,
				audit: makeAudit(),
			},
			BASE_INTEGRATION,
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([{ skillName: "format", pluginName: null }]);
	});

	it("does not call upsertMany when there are no skill_activated events", async () => {
		const { repo: integrations } = { repo: makeIntegrations() };
		const { repo: events } = makeEvents();
		const { repo: skills, upsertManyCalls } = makeSkills();

		const loki = makeLoki([
			streamWithEvent("claude_code.plugin_installed", { "plugin.name": "plugin-a" }),
		]);

		await syncIntegration(
			{
				integrations,
				events,
				skills,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkills().repo,
				marketplaces: makeMarketplaces(),
				loki,
				audit: makeAudit(),
			},
			BASE_INTEGRATION,
		);

		expect(upsertManyCalls).toHaveLength(0);
	});

	it("creates plugin (upsertIfAbsent) and plugin_skills link from a skill_activated event with plugin.name", async () => {
		const { repo: integrations } = { repo: makeIntegrations() };
		const { repo: events } = makeEvents();
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertCalls, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillsCalls } = makePluginSkills();

		const loki = makeLoki([
			streamWithEvent("claude_code.skill_activated", {
				"skill.name": "commit",
				"plugin.name": "John",
			}),
		]);

		await syncIntegration(
			{
				integrations,
				events,
				skills,
				plugins,
				pluginSkills,
				marketplaces: makeMarketplaces(),
				loki,
				audit: makeAudit(),
			},
			BASE_INTEGRATION,
		);

		expect(upsertIfAbsentCalls).toEqual([{ pluginName: "John", marketplaceName: null }]);
		expect(upsertCalls).toEqual([]);
		expect(pluginSkillsCalls).toHaveLength(1);
		expect(pluginSkillsCalls[0]).toEqual([{ pluginName: "John", skillName: "commit" }]);
	});

	it("does not touch plugins/plugin_skills when skill_activated has no plugin.name", async () => {
		const { repo: integrations } = { repo: makeIntegrations() };
		const { repo: events } = makeEvents();
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillsCalls } = makePluginSkills();

		const loki = makeLoki([
			streamWithEvent("claude_code.skill_activated", { "skill.name": "commit" }),
		]);

		await syncIntegration(
			{
				integrations,
				events,
				skills,
				plugins,
				pluginSkills,
				marketplaces: makeMarketplaces(),
				loki,
				audit: makeAudit(),
			},
			BASE_INTEGRATION,
		);

		expect(upsertIfAbsentCalls).toEqual([]);
		expect(pluginSkillsCalls).toEqual([]);
	});
});
