import { describe, expect, it } from "bun:test";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type {
	IGitMarketplaceGateway,
	MarketplaceJsonData,
} from "@/domain/ports/git-marketplace-gateway";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
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
	gitUrl: "github.com/org/repo",
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
	};
}

function makePlugins(removedNames: string[] = []) {
	const markRemovedCalls: Array<{ marketplaceName: string; activePluginNames: string[] }> = [];
	const listNamesCalls: string[] = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		upsert: async () => {},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async (marketplaceName, activePluginNames) => {
			markRemovedCalls.push({ marketplaceName, activePluginNames });
			return removedNames;
		},
		listNamesByMarketplace: async (marketplaceName) => {
			listNamesCalls.push(marketplaceName);
			return [];
		},
	};
	return { repo, markRemovedCalls, listNamesCalls };
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
					skills,
					gitMarketplace: makeGateway(),
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
					skills,
					gitMarketplace: makeGateway({ name: "acme-marketplace", plugins: [] }),
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
					skills,
					gitMarketplace: makeGateway("throw"),
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
					skills,
					gitMarketplace: makeGateway(),
					audit: makeAudit(),
				},
				{ ...BASE_SOURCE, importPluginsAndSkills: false },
			);

			expect(markRemovedCalls).toHaveLength(0);
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
					skills,
					gitMarketplace: makeGateway({
						name: "acme-marketplace",
						plugins: [
							{ name: "plugin-a", version: "1.0.0", skills: ["lint", "format"] },
							{ name: "plugin-b", version: "2.0.0", skills: ["lint"] },
						],
					}),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			expect(upsertManyCalls).toHaveLength(1);
			expect(upsertManyCalls[0]).toEqual([
				{ pluginName: "plugin-a", skillName: "lint" },
				{ pluginName: "plugin-a", skillName: "format" },
				{ pluginName: "plugin-b", skillName: "lint" },
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
					skills,
					gitMarketplace: makeGateway(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			const activeCall = propagateCalls.find((c) => c.status === "approved");
			expect(activeCall).toBeDefined();
			expect(activeCall?.pluginNames).toEqual(["plugin-a", "plugin-b"]);
		});

		it("propagates 'removed' to skills exclusively linked to plugins removed by the sync", async () => {
			const { repo: plugins } = makePlugins(["plugin-c"]);
			const { repo: skills, propagateCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces("approved"),
					plugins,
					pluginSkills: makePluginSkills(),
					skills,
					gitMarketplace: makeGateway(),
					audit: makeAudit(),
				},
				BASE_SOURCE,
			);

			const removedCall = propagateCalls.find((c) => c.status === "removed");
			expect(removedCall).toBeDefined();
			expect(removedCall?.pluginNames).toEqual(["plugin-c"]);
		});

		it("does NOT propagate when no plugins are removed", async () => {
			const { repo: plugins } = makePlugins([]);
			const { repo: skills, propagateCalls } = makeSkills();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					skills,
					gitMarketplace: makeGateway(),
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
					skills,
					gitMarketplace: makeGateway(),
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
					skills,
					gitMarketplace: makeGateway("throw"),
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
					skills,
					gitMarketplace: makeGateway({
						error: 'marketplace.json not found (HTTP 404). Check the git URL and branch ("main").',
					}),
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
					skills,
					gitMarketplace: makeGateway({
						error: "Authentication failed (HTTP 401). Check the access token.",
					}),
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
					skills,
					gitMarketplace: makeGateway(),
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
