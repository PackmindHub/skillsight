import { describe, expect, it } from "bun:test";
import { syncMarketplaceSource } from "./sync-marketplace-source";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IGitMarketplaceGateway, MarketplaceJsonData } from "@/domain/ports/git-marketplace-gateway";

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

function makeMarketplaceSources(): IMarketplaceSourceRepository {
	return {
		findAll: async () => [],
		findById: async () => null,
		create: async () => ({ ...BASE_SOURCE }),
		update: async () => ({ ...BASE_SOURCE }),
		delete: async () => {},
		updateSyncStatus: async () => {},
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

function makePlugins() {
	const markRemovedCalls: Array<{ marketplaceName: string; activePluginNames: string[] }> = [];
	const repo: IPluginRepository = {
		listWithStats: async () => [],
		upsert: async () => {},
		updateStatusByMarketplace: async () => {},
		markRemovedByMarketplace: async (marketplaceName, activePluginNames) => {
			markRemovedCalls.push({ marketplaceName, activePluginNames });
		},
	};
	return { repo, markRemovedCalls };
}

function makePluginSkills(): IPluginSkillRepository {
	return {
		upsertMany: async () => {},
		listByPlugin: async () => [],
	};
}

function makeGateway(result: MarketplaceJsonData | "throw" = BASE_MARKETPLACE_DATA): IGitMarketplaceGateway {
	return {
		fetchMarketplaceJson: async () => {
			if (result === "throw") throw new Error("network error");
			return result;
		},
	};
}

// --- tests ---

describe("syncMarketplaceSource", () => {
	describe("markRemovedByMarketplace", () => {
		it("is called with marketplace name and active plugin names after a successful sync", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway(),
				},
				BASE_SOURCE,
			);

			expect(markRemovedCalls).toHaveLength(1);
			expect(markRemovedCalls[0].marketplaceName).toBe("acme-marketplace");
			expect(markRemovedCalls[0].activePluginNames).toEqual(["plugin-a", "plugin-b"]);
		});

		it("is called with an empty array when the marketplace returns no plugins", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway({ name: "acme-marketplace", plugins: [] }),
				},
				BASE_SOURCE,
			);

			expect(markRemovedCalls).toHaveLength(1);
			expect(markRemovedCalls[0].activePluginNames).toEqual([]);
		});

		it("is NOT called when the gateway fetch fails", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway("throw"),
				},
				BASE_SOURCE,
			);

			expect(result.error).toBe("network error");
			expect(markRemovedCalls).toHaveLength(0);
		});

		it("is NOT called when importPluginsAndSkills is false", async () => {
			const { repo: plugins, markRemovedCalls } = makePlugins();

			await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway(),
				},
				{ ...BASE_SOURCE, importPluginsAndSkills: false },
			);

			expect(markRemovedCalls).toHaveLength(0);
		});
	});

	describe("return value", () => {
		it("returns pluginCount and skillCount on success", async () => {
			const { repo: plugins } = makePlugins();

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway(),
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

			const result = await syncMarketplaceSource(
				{
					marketplaceSources: makeMarketplaceSources(),
					marketplaces: makeMarketplaces(),
					plugins,
					pluginSkills: makePluginSkills(),
					gitMarketplace: makeGateway("throw"),
				},
				BASE_SOURCE,
			);

			expect(result.syncedAt).toBeNull();
			expect(result.pluginCount).toBe(0);
			expect(result.skillCount).toBe(0);
			expect(result.error).toBe("network error");
		});
	});
});
