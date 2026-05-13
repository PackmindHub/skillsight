import { describe, expect, it } from "bun:test";
import { deleteMarketplaces, DELETE_MARKETPLACES_MAX_BATCH } from "./delete-marketplaces";
import type { Marketplace } from "@/domain/marketplace";
import type { MarketplaceSource } from "@/domain/marketplace-source";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";

type AuditCall = Parameters<IAuditRepository["log"]>[0];

function makeAudit() {
	const calls: AuditCall[] = [];
	const audit: IAuditRepository = {
		log: async (entry) => {
			calls.push(entry);
		},
		list: async () => ({ items: [], total: 0 }),
		listAll: async () => [],
	};
	return { audit, calls };
}

function makeMarketplaceRepo(initial: Marketplace[]) {
	const state = new Map(initial.map((m) => [m.name, m]));
	const repo: IMarketplaceRepository = {
		listWithStats: async () => [],
		findByName: async (name) => state.get(name) ?? null,
		delete: async (name) => state.delete(name),
		update: async () => {
			throw new Error("not used");
		},
		upsertSeen: async () => {},
		upsertFromImport: async () => {},
		listStatuses: async () => [],
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
	return { repo, state };
}

function makeSourceRepo(linked: Record<string, MarketplaceSource[]> = {}) {
	const state = { ...linked };
	const deleteCalls: string[] = [];
	const repo: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => null,
		findByMarketplaceName: async (name) => state[name] ?? [],
		create: async () => {
			throw new Error("not used");
		},
		update: async () => {
			throw new Error("not used");
		},
		delete: async (id) => {
			deleteCalls.push(id);
			for (const name of Object.keys(state)) {
				state[name] = state[name].filter((s) => s.id !== id);
			}
		},
		updateSyncStatus: async () => {},
	};
	return { repo, deleteCalls };
}

function makePluginRepo(opts: { byMarketplace: Record<string, string[]> }) {
	const state = { byMarketplace: { ...opts.byMarketplace } };
	const calls: Record<string, string[]> = {
		listNames: [],
		orphanByMarketplace: [],
		deleteByMarketplace: [],
	};
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => [],
		listTopUsers: async () => [],
		upsert: async () => {},
		upsertIfAbsent: async () => {},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async () => [],
		listNamesByMarketplace: async (name) => {
			calls.listNames.push(name);
			return state.byMarketplace[name] ?? [];
		},
		orphanByMarketplace: async (name) => {
			calls.orphanByMarketplace.push(name);
			const names = state.byMarketplace[name] ?? [];
			delete state.byMarketplace[name];
			return names;
		},
		deleteByMarketplace: async (name) => {
			calls.deleteByMarketplace.push(name);
			const names = state.byMarketplace[name] ?? [];
			delete state.byMarketplace[name];
			return names;
		},
	};
	return { repo, calls, state };
}

function makePluginSkillRepo() {
	const calls: string[][] = [];
	const repo: IPluginSkillRepository = {
		upsertMany: async () => {},
		deleteByPlugins: async (names) => {
			calls.push(names);
		},
	};
	return { repo, calls };
}

function makeSkillRepo() {
	const calls: string[][] = [];
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
		propagateStatusFromPlugins: async () => {},
		deleteByPlugins: async (names) => {
			calls.push(names);
		},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
	};
	return { repo, calls };
}

function makeMarketplace(name: string): Marketplace {
	return {
		name,
		status: "approved",
		url: "https://example.com",
		description: null,
		firstSeenAt: new Date(),
		lastSeenAt: new Date(),
	};
}

function makeSource(id: string, marketplaceName: string): MarketplaceSource {
	return {
		id,
		gitUrl: `github.com/org/${id}`,
		hasToken: false,
		branch: null,
		marketplaceName,
		syncIntervalMs: 3600000,
		enabled: true,
		importPluginsAndSkills: true,
		lastSyncAt: null,
		lastSyncError: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("deleteMarketplaces", () => {
	it("returns 'empty' when no names are provided", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces } = makeMarketplaceRepo([]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names: ["", "  ", ""], mode: "orphan", withSources: false, actorEmail: null },
		);

		expect(result).toEqual({ error: "empty" });
		expect(auditCalls).toEqual([]);
	});

	it("returns 'too_many' when more than the batch cap are provided", async () => {
		const { audit } = makeAudit();
		const { repo: marketplaces } = makeMarketplaceRepo([]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const names = Array.from({ length: DELETE_MARKETPLACES_MAX_BATCH + 1 }, (_, i) => `mp-${i}`);
		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names, mode: "orphan", withSources: false, actorEmail: null },
		);

		expect(result).toEqual({ error: "too_many" });
	});

	it("dedupes and trims names before processing", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state } = makeMarketplaceRepo([makeMarketplace("mp-a")]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{
				names: ["mp-a", " mp-a ", "mp-a"],
				mode: "orphan",
				withSources: false,
				actorEmail: null,
			},
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(1);
		expect(state.has("mp-a")).toBe(false);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].metadata).toMatchObject({ requested: 1, deleted: 1 });
	});

	it("orphan mode: deletes marketplaces, orphans their plugins, records one summary audit", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo([
			makeMarketplace("mp-a"),
			makeMarketplace("mp-b"),
		]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins, calls: pluginCalls } = makePluginRepo({
			byMarketplace: { "mp-a": ["p1", "p2"], "mp-b": ["p3"] },
		});
		const { repo: pluginSkills, calls: pskCalls } = makePluginSkillRepo();
		const { repo: skills, calls: skillCalls } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{
				names: ["mp-a", "mp-b"],
				mode: "orphan",
				withSources: false,
				actorEmail: "admin@example.com",
			},
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(2);
		expect(result.notFound).toBe(0);
		expect(result.blocked).toBe(0);
		expect(mpState.size).toBe(0);
		expect(pluginCalls.orphanByMarketplace).toEqual(["mp-a", "mp-b"]);
		expect(pluginCalls.deleteByMarketplace).toEqual([]);
		expect(pskCalls).toEqual([]);
		expect(skillCalls).toEqual([]);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("marketplaces_deleted");
		expect(auditCalls[0].actorEmail).toBe("admin@example.com");
		expect(auditCalls[0].metadata).toMatchObject({
			requested: 2,
			deleted: 2,
			notFound: 0,
			blocked: 0,
			mode: "orphan",
			withSources: false,
		});
	});

	it("cascade mode: deletes plugin_skills, skills, plugins, and marketplaces", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo([
			makeMarketplace("mp-a"),
			makeMarketplace("mp-b"),
		]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins, calls: pluginCalls } = makePluginRepo({
			byMarketplace: { "mp-a": ["p1"], "mp-b": ["p2", "p3"] },
		});
		const { repo: pluginSkills, calls: pskCalls } = makePluginSkillRepo();
		const { repo: skills, calls: skillCalls } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names: ["mp-a", "mp-b"], mode: "cascade", withSources: false, actorEmail: null },
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(2);
		expect(mpState.size).toBe(0);
		expect(pluginCalls.deleteByMarketplace).toEqual(["mp-a", "mp-b"]);
		expect(pskCalls).toEqual([["p1"], ["p2", "p3"]]);
		expect(skillCalls).toEqual([["p1"], ["p2", "p3"]]);
		expect(auditCalls[0].metadata).toMatchObject({ mode: "cascade", deleted: 2 });
	});

	it("blocks marketplaces with linked sources when withSources=false, but deletes the others", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo([
			makeMarketplace("mp-a"),
			makeMarketplace("mp-b"),
		]);
		const { repo: marketplaceSources, deleteCalls: sourceDeleteCalls } = makeSourceRepo({
			"mp-a": [makeSource("src-a1", "mp-a")],
		});
		const { repo: plugins } = makePluginRepo({ byMarketplace: { "mp-b": ["p1"] } });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names: ["mp-a", "mp-b"], mode: "orphan", withSources: false, actorEmail: null },
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(1);
		expect(result.blocked).toBe(1);
		expect(result.notFound).toBe(0);
		expect(mpState.has("mp-a")).toBe(true);
		expect(mpState.has("mp-b")).toBe(false);
		expect(sourceDeleteCalls).toEqual([]);
		expect(result.items).toEqual([
			{ name: "mp-a", outcome: "linked_sources", sourceIds: ["src-a1"] },
			{ name: "mp-b", outcome: "deleted", affectedPluginNames: ["p1"], deletedSourceIds: [] },
		]);
		expect(auditCalls[0].metadata).toMatchObject({
			requested: 2,
			deleted: 1,
			blocked: 1,
		});
	});

	it("withSources=true: deletes each linked source, aggregates deletedSourceIds", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces } = makeMarketplaceRepo([
			makeMarketplace("mp-a"),
			makeMarketplace("mp-b"),
		]);
		const { repo: marketplaceSources, deleteCalls: sourceDeleteCalls } = makeSourceRepo({
			"mp-a": [makeSource("src-a1", "mp-a"), makeSource("src-a2", "mp-a")],
			"mp-b": [makeSource("src-b1", "mp-b")],
		});
		const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names: ["mp-a", "mp-b"], mode: "orphan", withSources: true, actorEmail: null },
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(2);
		expect(result.deletedSourceIds).toEqual(["src-a1", "src-a2", "src-b1"]);
		expect(sourceDeleteCalls).toEqual(["src-a1", "src-a2", "src-b1"]);
		expect(auditCalls[0].metadata).toMatchObject({
			deletedSourceCount: 3,
			withSources: true,
		});
	});

	it("reports not_found per item for unknown marketplaces", async () => {
		const { audit } = makeAudit();
		const { repo: marketplaces } = makeMarketplaceRepo([makeMarketplace("mp-a")]);
		const { repo: marketplaceSources } = makeSourceRepo();
		const { repo: plugins } = makePluginRepo({ byMarketplace: { "mp-a": [] } });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplaces(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ names: ["mp-a", "missing"], mode: "orphan", withSources: false, actorEmail: null },
		);

		if ("error" in result) throw new Error("unexpected error result");
		expect(result.deleted).toBe(1);
		expect(result.notFound).toBe(1);
		expect(result.items[1]).toEqual({ name: "missing", outcome: "not_found" });
	});
});
