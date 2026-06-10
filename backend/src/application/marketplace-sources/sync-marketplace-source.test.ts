import { describe, expect, it } from "bun:test";
import { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type { IExternalSkillPluginMappingRepository } from "@/domain/ports/external-skill-plugin-mapping-repository";
import type {
	IGitMarketplaceGateway,
	MarketplaceJsonData,
} from "@/domain/ports/git-marketplace-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IPackmindCliGateway } from "@/domain/ports/packmind-cli-gateway";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type {
	ISkillRepository,
	SkillUpsertEntry,
} from "@/domain/ports/skill-repository";
import type { SkillStatus } from "@/domain/skill";
import { syncMarketplaceSource } from "./sync-marketplace-source";

// --- fixtures ---

const BASE_SOURCE: MarketplaceSourceWithSecret = {
	id: "src-1",
	kind: "git",
	gitUrl: "github.com/org/repo",
	provider: "auto",
	accessTokenEncrypted: null,
	hasToken: false,
	branch: null,
	marketplaceName: null,
	syncIntervalMs: 3600000,
	enabled: true,
	importPluginsAndSkills: true,
	lastSyncAt: null,
	lastSyncError: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function makeMappingRepo(): IExternalSkillPluginMappingRepository {
	return {
		findAll: async () => [],
		findByName: async () => null,
		upsertMany: async () => {},
		deleteBySourceId: async () => {},
		deleteMissingForSource: async () => {},
	};
}

async function makeMappingCache() {
	const c = new ExternalSkillMappingCache(makeMappingRepo());
	await c.load();
	return c;
}

function makePackmindCli(): IPackmindCliGateway {
	return {
		whoami: async () => ({ user: "u", org: "o", host: "h" }),
		listPackages: async () => [],
		showPackage: async () => ({
			slug: "@x/y",
			spaceSlug: "@x",
			spaceName: "X",
			displayName: "Y",
			url: null,
			skills: [],
		}),
	};
}

const BASE_MARKETPLACE_DATA: MarketplaceJsonData = {
	name: "acme-marketplace",
	plugins: [
		{ name: "plugin-a", version: "1.0.0", skills: ["lint"] },
		{ name: "plugin-b", version: "2.0.0", skills: [] },
	],
};

// --- mock builders ---

type UpdateSyncStatusCall = Parameters<IMarketplaceSourceRepository["updateSyncStatus"]>;

function makeMarketplaceSources(): IMarketplaceSourceRepository & {
	updateSyncStatusCalls: UpdateSyncStatusCall[];
} {
	const updateSyncStatusCalls: UpdateSyncStatusCall[] = [];
	return {
		findAll: async () => [],
		findById: async () => null,
		create: async () => ({ ...BASE_SOURCE }),
		update: async () => ({ ...BASE_SOURCE }),
		delete: async () => {},
		updateSyncStatus: async (...args) => {
			updateSyncStatusCalls.push(args);
		},
		updateSyncStatusCalls,
	};
}

function makeMarketplaces(status = "approved"): IMarketplaceRepository {
	return {
		listWithStats: async () => [],
		findByName: async () => ({
			name: "acme-marketplace",
			status: status as "approved" | "to_review" | "denied",
			url: null,
			description: null,
			firstSeenAt: new Date(),
			lastSeenAt: new Date(),
		}),
		update: async () => {
			throw new Error("not needed");
		},
		upsertSeen: async () => {},
		upsertFromImport: async () => {},
		listStatuses: async () => [],
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
}

function makePlugins(
	options: { removedNames?: string[]; reactivatedNames?: string[] } = {},
) {
	const removedNames = options.removedNames ?? [];
	const reactivatedNames = options.reactivatedNames ?? [];
	const upsertCalls: Array<{ pluginName: string; status: string }> = [];
	const markRemovedCalls: Array<{ marketplaceName: string; activePluginNames: string[] }> = [];
	const reactivateCalls: Array<{
		marketplaceName: string;
		presentPluginNames: string[];
		newStatus: string;
	}> = [];
	const listNamesCalls: string[] = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		listSkillsWithActivations: async () => [],
		listTopUsers: async () => [],
		upsert: async (plugin) => {
			upsertCalls.push({ pluginName: plugin.pluginName, status: plugin.status });
		},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async (marketplaceName, activePluginNames) => {
			markRemovedCalls.push({ marketplaceName, activePluginNames });
			return removedNames;
		},
		reactivateRemovedByMarketplace: async (marketplaceName, presentPluginNames, newStatus) => {
			reactivateCalls.push({ marketplaceName, presentPluginNames, newStatus });
			return reactivatedNames;
		},
		listNamesByMarketplace: async (marketplaceName) => {
			listNamesCalls.push(marketplaceName);
			return [];
		},
	};
	return { repo, upsertCalls, markRemovedCalls, reactivateCalls, listNamesCalls };
}

function makePluginSkills(): IPluginSkillRepository {
	return {
		upsertMany: async () => {},
	};
}

function makeSkills() {
	const upsertManyCalls: SkillUpsertEntry[][] = [];
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
		upsertMany: async (entries) => {
			upsertManyCalls.push(entries);
		},
		propagateStatusFromPlugins: async (pluginNames, status) => {
			propagateCalls.push({ pluginNames, status });
		},
		deleteByPlugins: async () => {},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
		relinkOrphans: async () => 0,
	};
	return { repo, upsertManyCalls, propagateCalls };
}

function makeAudit(): IAuditRepository {
	return {
		log: async () => {},
		list: async () => ({ items: [], total: 0 }),
		listAll: async () => [],
	};
}

function makeGateway(
	result: MarketplaceJsonData | "throw" | { error: string } = BASE_MARKETPLACE_DATA,
): IGitMarketplaceGateway {
	return {
		fetchMarketplaceJson: async () => {
			if (result === "throw") throw new Error("network error");
			if (typeof result === "object" && "error" in result) throw new Error(result.error);
			return result;
		},
	};
}

// --- tests ---

describe("syncMarketplaceSource", () => {
	it("forwards the source's provider to the marketplace gateway", async () => {
		let received: { provider?: string } | null = null;
		const capturingGateway: IGitMarketplaceGateway = {
			fetchMarketplaceJson: async (params) => {
				received = params;
				return BASE_MARKETPLACE_DATA;
			},
		};
		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplaces(),
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkills(),
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkills().repo,
				gitMarketplace: capturingGateway,
				packmindCli: makePackmindCli(),
				externalSkillMappings: makeMappingRepo(),
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			{ ...BASE_SOURCE, provider: "gitlab" },
			{ mode: "manual" },
		);
		expect(received?.provider).toBe("gitlab");
	});

	describe("markRemovedByMarketplace", () => {
		it("is called with marketplace name and active plugin names after a successful sync", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(markRemovedCalls).toHaveLength(1);
			expect(markRemovedCalls[0].marketplaceName).toBe("acme-marketplace");
			expect(markRemovedCalls[0].activePluginNames).toEqual(["plugin-a", "plugin-b"]);
		});

		it("is called with an empty array when the marketplace returns no plugins", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway({ name: "acme-marketplace", plugins: [] }),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(markRemovedCalls).toHaveLength(1);
			expect(markRemovedCalls[0].activePluginNames).toEqual([]);
		});

		it("is NOT called when the gateway fetch fails", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway("throw"),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(result.error).toBe("network error");
			expect(markRemovedCalls).toHaveLength(0);
		});

		it("is NOT called when importPluginsAndSkills is false", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				{ ...BASE_SOURCE, importPluginsAndSkills: false },
			);

			expect(markRemovedCalls).toHaveLength(0);
		});

		it("upserts plugins listed in marketplace.json even when they have no skills", async () => {
			const { repo: plugins, upsertCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(upsertCalls.map((c) => c.pluginName).sort()).toEqual(["plugin-a", "plugin-b"]);
		});
	});

	describe("reactivateRemovedByMarketplace", () => {
		it("is called with all present plugin names and the marketplace-computed status", async () => {
			const { repo: plugins, reactivateCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces("approved"),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(reactivateCalls).toHaveLength(1);
			expect(reactivateCalls[0].marketplaceName).toBe("acme-marketplace");
			expect(reactivateCalls[0].presentPluginNames).toEqual(["plugin-a", "plugin-b"]);
			expect(reactivateCalls[0].newStatus).toBe("approved");
		});

		it("is NOT called when the gateway fetch fails (connection error → no status mutations)", async () => {
			const { repo: plugins, upsertCalls, markRemovedCalls, reactivateCalls } = makePlugins();
			const { repo: skills, propagateCalls } = makeSkills();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway("throw"),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(result.error).toBe("network error");
			expect(upsertCalls).toHaveLength(0);
			expect(markRemovedCalls).toHaveLength(0);
			expect(reactivateCalls).toHaveLength(0);
			expect(propagateCalls).toHaveLength(0);
		});

		it("is NOT called when importPluginsAndSkills is false", async () => {
			const { repo: plugins, reactivateCalls } = makePlugins();
			const { repo: skills } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				{ ...BASE_SOURCE, importPluginsAndSkills: false },
			);

			expect(reactivateCalls).toHaveLength(0);
		});
	});

	describe("skills propagation", () => {
		it("upserts (skill, plugin) tuples into the skills repo", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills, upsertManyCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway({
						name: "acme-marketplace",
						plugins: [
							{ name: "plugin-a", version: "1.0.0", skills: ["lint", "format"] },
							{ name: "plugin-b", version: "2.0.0", skills: ["lint"] },
						],
					}),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(upsertManyCalls).toHaveLength(1);
			expect(upsertManyCalls[0]).toEqual([
				{
					pluginName: "plugin-a",
					skillName: "plugin-a:lint",
					marketplaceName: "acme-marketplace",
					skillSource: "plugin",
				},
				{
					pluginName: "plugin-a",
					skillName: "plugin-a:format",
					marketplaceName: "acme-marketplace",
					skillSource: "plugin",
				},
				{
					pluginName: "plugin-b",
					skillName: "plugin-b:lint",
					marketplaceName: "acme-marketplace",
					skillSource: "plugin",
				},
			]);
		});

		it("propagates the marketplace plugin status to active plugin skills", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills, propagateCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces("approved"),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			const activeCall = propagateCalls.find((c) => c.status === "approved");
			expect(activeCall).toBeDefined();
			expect(activeCall?.pluginNames).toEqual(["plugin-a", "plugin-b"]);
		});

		it("propagates 'removed' to skills exclusively linked to plugins removed by the sync", async () => {
			const { repo: plugins } = makePlugins({ removedNames: ["plugin-c"] });
			const { repo: skills, propagateCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces("approved"),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			const removedCall = propagateCalls.find((c) => c.status === "removed");
			expect(removedCall).toBeDefined();
			expect(removedCall?.pluginNames).toEqual(["plugin-c"]);
		});

		it("does NOT propagate when no plugins are removed", async () => {
			const { repo: plugins } = makePlugins({ removedNames: [] });
			const { repo: skills, propagateCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(propagateCalls.find((c) => c.status === "removed")).toBeUndefined();
		});
	});

	describe("return value", () => {
		it("returns pluginCount and skillCount on success", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills } = makeSkills();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(result.error).toBeNull();
			expect(result.pluginCount).toBe(2);
			expect(result.skillCount).toBe(1);
			expect(result.syncedAt).toBeInstanceOf(Date);
		});

		it("returns error and zero counts on failure", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills } = makeSkills();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway("throw"),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(result.syncedAt).toBeNull();
			expect(result.pluginCount).toBe(0);
			expect(result.skillCount).toBe(0);
			expect(result.error).toBe("network error");
		});
	});

	describe("error persistence", () => {
		it("persists the error message via updateSyncStatus when the gateway throws (broken URL)", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills } = makeSkills();
			const marketplaceSources = makeMarketplaceSources();

			await syncMarketplaceSource(
				{
					marketplaceSources,
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway({
						error: 'marketplace.json not found (HTTP 404). Check the git URL and branch ("main").',
					}),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(marketplaceSources.updateSyncStatusCalls).toHaveLength(1);
			const [id, status] = marketplaceSources.updateSyncStatusCalls[0];
			expect(id).toBe(BASE_SOURCE.id);
			expect(status.lastSyncError).toBe(
				'marketplace.json not found (HTTP 404). Check the git URL and branch ("main").',
			);
			expect(status.lastSyncAt).toBeUndefined();
		});

		it("persists an authentication failure message (broken credentials)", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills } = makeSkills();
			const marketplaceSources = makeMarketplaceSources();

			await syncMarketplaceSource(
				{
					marketplaceSources,
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway({
						error: "Authentication failed (HTTP 401). Check the access token.",
					}),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			const [, status] = marketplaceSources.updateSyncStatusCalls[0];
			expect(status.lastSyncError).toBe(
				"Authentication failed (HTTP 401). Check the access token.",
			);
		});

		it("clears lastSyncError on a successful sync", async () => {
			const { repo: plugins } = makePlugins();
			const { repo: skills } = makeSkills();
			const marketplaceSources = makeMarketplaceSources();

			await syncMarketplaceSource(
				{
					marketplaceSources,
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					pluginVersions: { upsertSeen: async () => {}, listForPlugin: async () => [], listVersionStrings: async () => [] },
					skills,
					gitMarketplace: makeGateway(),
					packmindCli: makePackmindCli(),
					externalSkillMappings: makeMappingRepo(),
					mappingCache: await makeMappingCache(),
					audit: makeAudit(),
				},
				{ ...BASE_SOURCE, lastSyncError: "previous failure" },
			);

			const [, status] = marketplaceSources.updateSyncStatusCalls[0];
			expect(status.lastSyncError).toBeNull();
			expect(status.lastSyncAt).toBeInstanceOf(Date);
		});
	});
});

// --- Packmind sync ---

function makeMarketplacesCapture(status: "approved" | "to_review" | "denied" = "approved") {
	const upsertImportCalls: Array<{
		name: string;
		provider?: string;
		url?: string | null;
		description?: string | null;
	}> = [];
	const repo: IMarketplaceRepository = {
		listWithStats: async () => [],
		findByName: async () => ({
			name: "Packmind",
			status,
			provider: "packmind",
			url: null,
			description: null,
			firstSeenAt: new Date(),
			lastSeenAt: new Date(),
		}),
		update: async () => {
			throw new Error("not needed");
		},
		upsertSeen: async () => {},
		upsertFromImport: async (data) => {
			upsertImportCalls.push(data);
		},
		listStatuses: async () => [],
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
	return { repo, upsertImportCalls };
}

function makePluginSkillsCapture() {
	const upsertManyCalls: Array<Array<{ pluginName: string; skillName: string }>> = [];
	const deleteByPluginsCalls: string[][] = [];
	const repo: IPluginSkillRepository = {
		upsertMany: async (rows) => {
			upsertManyCalls.push(rows);
		},
		deleteByPlugins: async (names) => {
			deleteByPluginsCalls.push(names);
		},
	};
	return { repo, upsertManyCalls, deleteByPluginsCalls };
}

function makeSkillsCapture() {
	const upsertManyCalls: SkillUpsertEntry[][] = [];
	const propagateCalls: Array<{ pluginNames: string[]; status: SkillStatus }> = [];
	const relinkCalls: Array<Array<{ skillName: string; pluginName: string }>> = [];
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
		propagateStatusFromPlugins: async (pluginNames, status) => {
			propagateCalls.push({ pluginNames, status });
		},
		deleteByPlugins: async () => {},
		deleteByKeys: async () => 0,
		findByKey: async () => null,
		updateStatus: async () => null,
		relinkOrphans: async (entries) => {
			relinkCalls.push(entries);
			return entries.length;
		},
	};
	return { repo, upsertManyCalls, propagateCalls, relinkCalls };
}

function makeMappingRepoCapture() {
	const upsertManyCalls: Array<
		Array<{ skillName: string; pluginName: string; marketplaceName: string; sourceId: string }>
	> = [];
	const deleteMissingCalls: Array<{ sourceId: string; presentSkillNames: string[] }> = [];
	const repo: IExternalSkillPluginMappingRepository = {
		findAll: async () => [],
		findByName: async () => null,
		upsertMany: async (rows) => {
			upsertManyCalls.push(rows);
		},
		deleteBySourceId: async () => {},
		deleteMissingForSource: async (sourceId, presentSkillNames) => {
			deleteMissingCalls.push({ sourceId, presentSkillNames });
		},
	};
	return { repo, upsertManyCalls, deleteMissingCalls };
}

function makePackmindCliFixture(
	packages: Array<{ slug: string; skills: string[] }>,
): IPackmindCliGateway & { calls: { list: number; show: string[]; whoami: number } } {
	const calls = { list: 0, show: [] as string[], whoami: 0 };
	const cli = {
		whoami: async () => {
			calls.whoami++;
			return { user: "u@x", org: "Acme", host: "https://app.packmind.ai" };
		},
		listPackages: async () => {
			calls.list++;
			return packages.map((p) => ({
				slug: p.slug,
				spaceSlug: p.slug.split("/")[0],
				spaceName: p.slug.split("/")[0].replace(/^@/, ""),
				displayName: p.slug.split("/")[1] ?? p.slug,
				url: `https://app.packmind.ai/${p.slug}`,
			}));
		},
		showPackage: async (_apiKey: string, slug: string) => {
			calls.show.push(slug);
			const pkg = packages.find((p) => p.slug === slug);
			if (!pkg) throw new Error(`unknown package ${slug}`);
			return {
				slug,
				spaceSlug: slug.split("/")[0],
				spaceName: slug.split("/")[0].replace(/^@/, ""),
				displayName: slug.split("/")[1] ?? slug,
				url: `https://app.packmind.ai/${slug}`,
				skills: pkg.skills.map((name) => ({ name, description: null })),
			};
		},
	};
	return Object.assign(cli, { calls });
}

const PACKMIND_SOURCE: MarketplaceSourceWithSecret = {
	...BASE_SOURCE,
	id: "src-packmind-1",
	kind: "packmind",
	gitUrl: null,
	marketplaceName: "Packmind",
	// Encrypted with the test JWT_SECRET — sync decrypts and forwards.
	accessTokenEncrypted: null,
	hasToken: false,
};

describe("syncMarketplaceSource — Packmind kind", () => {
	it("upserts marketplace with provider='packmind' and the user-chosen name", async () => {
		const { repo: marketplaces, upsertImportCalls } = makeMarketplacesCapture();
		const { repo: marketplaceSources } = (() => {
			const inner = makeMarketplaceSources();
			return { repo: inner };
		})();

		// Use a real encrypted API key so the sync path's decrypt() doesn't throw.
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: (await import("@/infrastructure/crypto/encrypt")).encrypt("test-key"),
			hasToken: true,
		};

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: ["hexagonal-architecture"] },
			{ slug: "@global/generic", skills: ["qa-review", "doc-audit"] },
		]);

		const result = await syncMarketplaceSource(
			{
				marketplaceSources,
				marketplaces,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkillsCapture().repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: makeMappingRepoCapture().repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		expect(result.error).toBeNull();
		expect(result.pluginCount).toBe(2);
		expect(result.skillCount).toBe(3);
		expect(upsertImportCalls).toHaveLength(1);
		expect(upsertImportCalls[0].name).toBe("Packmind");
		expect(upsertImportCalls[0].provider).toBe("packmind");
	});

	it("upserts one plugin per Packmind package slug with the marketplace name", async () => {
		const { repo: plugins, upsertCalls } = makePlugins();
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
		};

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: [] },
			{ slug: "@frontend/react", skills: [] },
		]);

		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplacesCapture().repo,
				plugins,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkillsCapture().repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: makeMappingRepoCapture().repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		expect(upsertCalls).toHaveLength(2);
		expect(upsertCalls.map((c) => c.pluginName)).toEqual(["@backend/generic", "@frontend/react"]);
		expect(upsertCalls.every((c) => c.status === "approved")).toBe(true);
	});

	it("replaces plugin_skills via deleteByPlugins+upsertMany", async () => {
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
		};
		const pluginSkills = makePluginSkillsCapture();

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: ["hexagonal-architecture", "typeorm-migration"] },
			{ slug: "@global/generic", skills: ["qa-review"] },
		]);

		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplacesCapture().repo,
				plugins: makePlugins().repo,
				pluginSkills: pluginSkills.repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkillsCapture().repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: makeMappingRepoCapture().repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		expect(pluginSkills.deleteByPluginsCalls).toHaveLength(1);
		expect(pluginSkills.deleteByPluginsCalls[0]).toEqual(["@backend/generic", "@global/generic"]);
		expect(pluginSkills.upsertManyCalls).toHaveLength(1);
		expect(pluginSkills.upsertManyCalls[0]).toEqual([
			{ pluginName: "@backend/generic", skillName: "hexagonal-architecture" },
			{ pluginName: "@backend/generic", skillName: "typeorm-migration" },
			{ pluginName: "@global/generic", skillName: "qa-review" },
		]);
	});

	it("retro-links orphan skills and refreshes the external mapping table", async () => {
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
		};
		const skills = makeSkillsCapture();
		const mapping = makeMappingRepoCapture();

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: ["hexagonal-architecture"] },
		]);

		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplacesCapture().repo,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: skills.repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: mapping.repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		// relinkOrphans called with the declared pairs.
		expect(skills.relinkCalls).toHaveLength(1);
		expect(skills.relinkCalls[0]).toEqual([
			{
				skillName: "hexagonal-architecture",
				pluginName: "@backend/generic",
				marketplaceName: "Packmind",
			},
		]);

		// Mapping table populated with the (skillName -> plugin, marketplace, sourceId) row.
		expect(mapping.upsertManyCalls).toHaveLength(1);
		expect(mapping.upsertManyCalls[0]).toEqual([
			{
				skillName: "hexagonal-architecture",
				pluginName: "@backend/generic",
				marketplaceName: "Packmind",
				sourceId: sourceWithSecret.id,
			},
		]);

		// And stale entries from prior syncs of this source are dropped.
		expect(mapping.deleteMissingCalls).toHaveLength(1);
		expect(mapping.deleteMissingCalls[0]).toEqual({
			sourceId: sourceWithSecret.id,
			presentSkillNames: ["hexagonal-architecture"],
		});
	});

	it("cascades plugin status to skills via propagateStatusFromPlugins", async () => {
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
		};
		const skills = makeSkillsCapture();

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: ["lint"] },
			{ slug: "@global/generic", skills: ["doc-audit"] },
		]);

		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplacesCapture().repo,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: skills.repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: makeMappingRepoCapture().repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		const presentCall = skills.propagateCalls.find(
			(c) => c.pluginNames.length === 2 && c.status === "approved",
		);
		expect(presentCall).toBeDefined();
		expect(presentCall?.pluginNames).toEqual(["@backend/generic", "@global/generic"]);
	});

	it("refreshes the in-memory mapping cache after a successful sync", async () => {
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
		};

		// Build a mapping repo whose findAll() returns one entry only after sync runs.
		let synced = false;
		const mappingRepo: IExternalSkillPluginMappingRepository = {
			findAll: async () =>
				synced
					? [
							{
								skillName: "lint",
								pluginName: "@backend/generic",
								marketplaceName: "Packmind",
								sourceId: sourceWithSecret.id,
								syncedAt: new Date(),
							},
						]
					: [],
			findByName: async () => null,
			upsertMany: async () => {
				synced = true;
			},
			deleteBySourceId: async () => {},
			deleteMissingForSource: async () => {},
		};
		const cache = new ExternalSkillMappingCache(mappingRepo);
		await cache.load();
		expect(cache.size()).toBe(0);

		const cli = makePackmindCliFixture([
			{ slug: "@backend/generic", skills: ["lint"] },
		]);

		await syncMarketplaceSource(
			{
				marketplaceSources: makeMarketplaceSources(),
				marketplaces: makeMarketplacesCapture().repo,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkillsCapture().repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: mappingRepo,
				mappingCache: cache,
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		expect(cache.size()).toBe(1);
		expect(cache.lookup("lint")).toEqual({
			pluginName: "@backend/generic",
			marketplaceName: "Packmind",
		});
	});

	it("clears prior sync errors and stamps lastSyncAt on success", async () => {
		const { encrypt } = await import("@/infrastructure/crypto/encrypt");
		const sourceWithSecret: MarketplaceSourceWithSecret = {
			...PACKMIND_SOURCE,
			accessTokenEncrypted: encrypt("test-key"),
			hasToken: true,
			lastSyncError: "previous failure",
		};
		const marketplaceSources = makeMarketplaceSources();
		const cli = makePackmindCliFixture([{ slug: "@x/y", skills: [] }]);

		await syncMarketplaceSource(
			{
				marketplaceSources,
				marketplaces: makeMarketplacesCapture().repo,
				plugins: makePlugins().repo,
				pluginSkills: makePluginSkillsCapture().repo,
				pluginVersions: {
					upsertSeen: async () => {},
					listForPlugin: async () => [],
					listVersionStrings: async () => [],
				},
				skills: makeSkillsCapture().repo,
				gitMarketplace: makeGateway(),
				packmindCli: cli,
				externalSkillMappings: makeMappingRepoCapture().repo,
				mappingCache: await makeMappingCache(),
				audit: makeAudit(),
			},
			sourceWithSecret,
		);

		const [, status] = marketplaceSources.updateSyncStatusCalls.at(-1) ?? [];
		expect(status?.lastSyncError).toBeNull();
		expect(status?.lastSyncAt).toBeInstanceOf(Date);
		expect(status?.marketplaceName).toBe("Packmind");
	});
});
