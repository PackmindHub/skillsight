import { describe, expect, it } from "bun:test";
import { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import { EVENT_NAMES } from "@/domain/event";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import type {
	ISkillRepository,
	SkillUpsertEntry,
} from "@/domain/ports/skill-repository";
import { ingestEvents } from "./ingest-events";

function makeMappingCache(initial: Array<{ skillName: string; pluginName: string; marketplaceName: string }> = []) {
	const repo: IExternalSkillPluginMappingRepository = {
		findAll: async () =>
			initial.map((e) => ({
				skillName: e.skillName,
				pluginName: e.pluginName,
				marketplaceName: e.marketplaceName,
				sourceId: "stub",
				syncedAt: new Date(),
			})),
		findByName: async () => null,
		upsertMany: async () => {},
		deleteBySourceId: async () => {},
		deleteMissingForSource: async () => {},
	};
	const cache = new ExternalSkillMappingCache(repo);
	return cache;
}

async function loadCache(initial: Parameters<typeof makeMappingCache>[0] = []) {
	const cache = makeMappingCache(initial);
	await cache.load();
	return cache;
}

function makeEvents(): IEventRepository {
	return {
		insertMany: async () => {},
		deleteByIntegrationId: async () => {},
		deleteBySkillKeys: async () => 0,
		listRecentSkillActivations: async () => [],
		listUserSkillActivations: async () => [],
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

function makePluginVersions() {
	const upsertSeenCalls: Array<
		Array<{ pluginName: string; marketplaceName: string | null; version: string }>
	> = [];
	const repo: IPluginVersionRepository = {
		upsertSeen: async (entries) => {
			upsertSeenCalls.push(entries.map((e) => ({ ...e })));
		},
		listForPlugin: async () => [],
		listVersionStrings: async () => [],
	};
	return { repo, upsertSeenCalls };
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
		relinkOrphans: async () => 0,
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
			{ skillName: "lint", pluginName: "plugin-a", marketplaceName: null, skillSource: "plugin" },
			{ skillName: "lint", pluginName: "plugin-b", marketplaceName: null, skillSource: "plugin" },
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "format" },
				},
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([
			{ skillName: "format", pluginName: null, marketplaceName: null, skillSource: "" },
		]);
	});

	it("retro-links via the mapping cache when plugin.name is absent but a mapping exists", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills, upsertManyCalls: pluginSkillCalls } = makePluginSkills();
		const cache = await loadCache([
			{
				skillName: "hexagonal-architecture",
				pluginName: "@backend/generic",
				marketplaceName: "Packmind",
			},
		]);

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: cache,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "hexagonal-architecture" },
				},
			]),
		);

		// The skill is upserted with the cache-resolved plugin name instead of null.
		expect(upsertManyCalls[0]).toEqual([
			{
				skillName: "hexagonal-architecture",
				pluginName: "@backend/generic",
				marketplaceName: "Packmind",
				skillSource: "plugin",
			},
		]);
		// The plugin row is created via the auto-creation path with the resolved marketplace.
		expect(upsertIfAbsentCalls).toEqual([
			{ pluginName: "@backend/generic", marketplaceName: "Packmind" },
		]);
		// And the plugin_skills membership row is written.
		expect(pluginSkillCalls[0]).toEqual([
			{ pluginName: "@backend/generic", skillName: "hexagonal-architecture" },
		]);
	});

	it("prefers the explicit plugin.name attribute over the cache when both are present", async () => {
		const { repo: skills, upsertManyCalls } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const cache = await loadCache([
			{
				skillName: "lint",
				pluginName: "@backend/generic",
				marketplaceName: "Packmind",
			},
		]);

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: cache,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.SKILL_ACTIVATED,
					attrs: { "skill.name": "lint", "plugin.name": "@frontend/quality" },
				},
			]),
		);

		// The explicit plugin.name wins; the cache mapping is ignored.
		expect(upsertManyCalls[0]).toEqual([
			{
				skillName: "lint",
				pluginName: "@frontend/quality",
				marketplaceName: null,
				skillSource: "plugin",
			},
		]);
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{ eventName: EVENT_NAMES.SKILL_ACTIVATED, attrs: { "plugin.name": "x" } },
				{ eventName: EVENT_NAMES.SKILL_ACTIVATED, attrs: { "skill.name": "y" } },
			]),
		);

		expect(upsertManyCalls).toHaveLength(1);
		expect(upsertManyCalls[0]).toEqual([
			{ skillName: "y", pluginName: null, marketplaceName: null, skillSource: "" },
		]);
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
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

describe("ingestEvents — plugin_loaded", () => {
	it("upsertIfAbsent on plugin_loaded with a real plugin.name", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls, upsertCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "lint-plugin",
						"marketplace.name": "acme",
					},
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([
			{ pluginName: "lint-plugin", marketplaceName: "acme" },
		]);
		// load events must not clobber admin-set status — never go through upsert().
		expect(upsertCalls).toEqual([]);
	});

	it("skips redacted plugin.name='third-party' for the plugins catalog", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls, upsertCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "third-party",
						"marketplace.name": "third-party",
						plugin_id_hash: "abc123",
					},
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([]);
		expect(upsertCalls).toEqual([]);
	});

	it("treats (plugin=X, marketplace=A) and (plugin=X, marketplace=B) as distinct catalog entries", async () => {
		// The current `plugins` PK is just pluginName, so the second upsertIfAbsent
		// will be a no-op at the DB layer — but the application code must still
		// emit both calls so the day the schema gains a composite key, behavior
		// flips on automatically. Catalog limitation is noted in CLAUDE.md
		// follow-up; ingest path stays composite-key-correct.
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: { "plugin.name": "shared", "marketplace.name": "alpha" },
				},
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: { "plugin.name": "shared", "marketplace.name": "beta" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toEqual([
			{ pluginName: "shared", marketplaceName: "alpha" },
			{ pluginName: "shared", marketplaceName: "beta" },
		]);
	});

	it("upserts plugin_versions on plugin_loaded with a version", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: pluginVersions, upsertSeenCalls } = makePluginVersions();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "lint-plugin",
						"marketplace.name": "acme",
						"plugin.version": "1.2.3",
					},
				},
			]),
		);

		expect(upsertSeenCalls).toHaveLength(1);
		expect(upsertSeenCalls[0]).toEqual([
			{ pluginName: "lint-plugin", marketplaceName: "acme", version: "1.2.3" },
		]);
	});

	it("upserts plugin_versions on plugin_installed with a version", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: pluginVersions, upsertSeenCalls } = makePluginVersions();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_INSTALLED,
					attrs: {
						"plugin.name": "lint-plugin",
						"marketplace.name": "acme",
						"plugin.version": "1.2.3",
					},
				},
			]),
		);

		expect(upsertSeenCalls).toHaveLength(1);
		expect(upsertSeenCalls[0]).toEqual([
			{ pluginName: "lint-plugin", marketplaceName: "acme", version: "1.2.3" },
		]);
	});

	it("treats same version under different marketplaces as distinct version rows", async () => {
		// The reminder from the user: plugin-a v1.2.3 from marketplace alpha is
		// unrelated to plugin-a v1.2.3 from marketplace beta. Each must emit its
		// own row — the composite PK (plugin_name, marketplace_name, version) at
		// the storage layer is what ultimately keeps them apart, but the ingest
		// path must also emit both sightings instead of collapsing them.
		const { repo: skills } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: pluginVersions, upsertSeenCalls } = makePluginVersions();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "shared",
						"marketplace.name": "alpha",
						"plugin.version": "1.2.3",
					},
				},
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "shared",
						"marketplace.name": "beta",
						"plugin.version": "1.2.3",
					},
				},
			]),
		);

		expect(upsertSeenCalls).toHaveLength(1);
		expect(upsertSeenCalls[0]).toEqual([
			{ pluginName: "shared", marketplaceName: "alpha", version: "1.2.3" },
			{ pluginName: "shared", marketplaceName: "beta", version: "1.2.3" },
		]);
	});

	it("skips redacted plugin.name='third-party' even with a version present", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();
		const { repo: pluginVersions, upsertSeenCalls } = makePluginVersions();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions,
				skills,
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: {
						"plugin.name": "third-party",
						"plugin.version": "9.9.9",
					},
				},
			]),
		);

		expect(upsertSeenCalls).toEqual([]);
	});

	it("dedupes within a single ingest batch by (plugin.name, marketplace.name) pair", async () => {
		const { repo: skills } = makeSkills();
		const { repo: plugins, upsertIfAbsentCalls } = makePlugins();
		const { repo: pluginSkills } = makePluginSkills();

		await ingestEvents(
			{
				events: makeEvents(),
				marketplaces: makeMarketplaces(),
				plugins,
				pluginSkills,
				pluginVersions: makePluginVersions().repo,
				skills,
				mappingCache: await loadCache(),
			},
			otlpBody([
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: { "plugin.name": "p", "marketplace.name": "m" },
				},
				{
					eventName: EVENT_NAMES.PLUGIN_LOADED,
					attrs: { "plugin.name": "p", "marketplace.name": "m" },
				},
			]),
		);

		expect(upsertIfAbsentCalls).toHaveLength(1);
	});
});
