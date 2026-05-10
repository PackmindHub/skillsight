import { describe, expect, it } from "bun:test";
import { deleteMarketplace } from "./delete-marketplace";
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

function makeMarketplaceRepo(initial: Marketplace | null) {
	const state = { current: initial };
	const repo: IMarketplaceRepository = {
		listWithStats: async () => [],
		findByName: async (name) => (state.current && state.current.name === name ? state.current : null),
		delete: async (name) => {
			if (state.current && state.current.name === name) {
				state.current = null;
				return true;
			}
			return false;
		},
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

function makeSourceRepo(linked: MarketplaceSource[] = []) {
	const repo: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => null,
		findByMarketplaceName: async () => linked,
		create: async () => {
			throw new Error("not used");
		},
		update: async () => {
			throw new Error("not used");
		},
		delete: async () => {},
		updateSyncStatus: async () => {},
	};
	return repo;
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
	};
	return { repo, calls };
}

const BASE_MARKETPLACE: Marketplace = {
	name: "mp",
	status: "approved",
	url: "https://example.com",
	description: "test",
	firstSeenAt: new Date(),
	lastSeenAt: new Date(),
};

const BASE_SOURCE: MarketplaceSource = {
	id: "src-1",
	gitUrl: "github.com/org/repo",
	hasToken: false,
	branch: null,
	marketplaceName: "mp",
	syncIntervalMs: 3600000,
	enabled: true,
	importPluginsAndSkills: true,
	lastSyncAt: null,
	lastSyncError: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("deleteMarketplace", () => {
	it("returns not_found when the marketplace does not exist", async () => {
		const { audit } = makeAudit();
		const { repo: marketplaces } = makeMarketplaceRepo(null);
		const marketplaceSources = makeSourceRepo();
		const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
		const { repo: pluginSkills } = makePluginSkillRepo();
		const { repo: skills } = makeSkillRepo();

		const result = await deleteMarketplace(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ name: "missing", mode: "orphan" },
		);

		expect(result).toEqual({ ok: false, reason: "not_found" });
	});

	it("returns linked_sources and mutates nothing when a source still links the marketplace", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo(BASE_MARKETPLACE);
		const marketplaceSources = makeSourceRepo([BASE_SOURCE]);
		const { repo: plugins, calls: pluginCalls, state: pluginState } = makePluginRepo({
			byMarketplace: { mp: ["p1", "p2"] },
		});
		const { repo: pluginSkills, calls: pskCalls } = makePluginSkillRepo();
		const { repo: skills, calls: skillCalls } = makeSkillRepo();

		const result = await deleteMarketplace(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ name: "mp", mode: "cascade" },
		);

		expect(result).toEqual({ ok: false, reason: "linked_sources", sourceIds: ["src-1"] });
		// nothing mutated:
		expect(mpState.current).not.toBeNull();
		expect(pluginState.byMarketplace.mp).toEqual(["p1", "p2"]);
		expect(pluginCalls.orphanByMarketplace).toEqual([]);
		expect(pluginCalls.deleteByMarketplace).toEqual([]);
		expect(pskCalls).toEqual([]);
		expect(skillCalls).toEqual([]);
		expect(auditCalls).toEqual([]);
	});

	it("orphan mode: marks plugins removed, leaves plugin_skills/skills untouched, deletes marketplace, audits", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo(BASE_MARKETPLACE);
		const marketplaceSources = makeSourceRepo();
		const { repo: plugins, calls: pluginCalls } = makePluginRepo({ byMarketplace: { mp: ["p1", "p2"] } });
		const { repo: pluginSkills, calls: pskCalls } = makePluginSkillRepo();
		const { repo: skills, calls: skillCalls } = makeSkillRepo();

		const result = await deleteMarketplace(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ name: "mp", mode: "orphan" },
			{ actorEmail: "admin@example.com" },
		);

		expect(result).toEqual({ ok: true, mode: "orphan", affectedPluginNames: ["p1", "p2"] });
		expect(pluginCalls.orphanByMarketplace).toEqual(["mp"]);
		expect(pluginCalls.deleteByMarketplace).toEqual([]);
		expect(pskCalls).toEqual([]);
		expect(skillCalls).toEqual([]);
		expect(mpState.current).toBeNull();
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("marketplace_deleted");
		expect(auditCalls[0].target).toBe("mp");
		expect(auditCalls[0].actorEmail).toBe("admin@example.com");
		expect(auditCalls[0].metadata).toMatchObject({
			mode: "orphan",
			affectedPluginCount: 2,
			affectedPluginNames: ["p1", "p2"],
		});
	});

	it("cascade mode: deletes plugin_skills, skills, plugins, then marketplace; audits with mode=cascade", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo: marketplaces, state: mpState } = makeMarketplaceRepo(BASE_MARKETPLACE);
		const marketplaceSources = makeSourceRepo();
		const { repo: plugins, calls: pluginCalls, state: pluginState } = makePluginRepo({
			byMarketplace: { mp: ["p1", "p2"] },
		});
		const { repo: pluginSkills, calls: pskCalls } = makePluginSkillRepo();
		const { repo: skills, calls: skillCalls } = makeSkillRepo();

		const result = await deleteMarketplace(
			{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
			{ name: "mp", mode: "cascade" },
		);

		expect(result).toEqual({ ok: true, mode: "cascade", affectedPluginNames: ["p1", "p2"] });
		expect(pluginCalls.listNames).toEqual(["mp"]);
		expect(pskCalls).toEqual([["p1", "p2"]]);
		expect(skillCalls).toEqual([["p1", "p2"]]);
		expect(pluginCalls.deleteByMarketplace).toEqual(["mp"]);
		expect(pluginCalls.orphanByMarketplace).toEqual([]);
		expect(pluginState.byMarketplace.mp).toBeUndefined();
		expect(mpState.current).toBeNull();
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].metadata).toMatchObject({ mode: "cascade", affectedPluginCount: 2 });
	});

	it("succeeds with zero plugins in both modes", async () => {
		for (const mode of ["orphan", "cascade"] as const) {
			const { audit, calls: auditCalls } = makeAudit();
			const { repo: marketplaces } = makeMarketplaceRepo(BASE_MARKETPLACE);
			const marketplaceSources = makeSourceRepo();
			const { repo: plugins } = makePluginRepo({ byMarketplace: {} });
			const { repo: pluginSkills } = makePluginSkillRepo();
			const { repo: skills } = makeSkillRepo();

			const result = await deleteMarketplace(
				{ marketplaces, marketplaceSources, plugins, pluginSkills, skills, audit },
				{ name: "mp", mode },
			);

			expect(result).toEqual({ ok: true, mode, affectedPluginNames: [] });
			expect(auditCalls[0].metadata).toMatchObject({ mode, affectedPluginCount: 0 });
		}
	});
});
