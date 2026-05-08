import { describe, expect, it } from "bun:test";
import { updateMarketplaceSource } from "./update-marketplace-source";
import type { MarketplaceSource, MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";

const audit: IAuditRepository = {
	log: async () => {},
	list: async () => ({ items: [], total: 0 }),
	listAll: async () => [],
};

// --- helpers ---

const BASE_SOURCE: MarketplaceSourceWithSecret = {
	id: "src-1",
	gitUrl: "github.com/org/repo",
	accessTokenEncrypted: null,
	hasToken: false,
	branch: null,
	marketplaceName: null,
	syncIntervalMs: 3600000,
	enabled: true,
	importPluginsAndSkills: false,
	lastSyncAt: null,
	lastSyncError: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function makeRepo(existing: MarketplaceSourceWithSecret | null = BASE_SOURCE) {
	const updateCalls: Array<Parameters<IMarketplaceSourceRepository["update"]>[1]> = [];
	const repo: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => existing,
		create: async () => existing as MarketplaceSource,
		update: async (_id, data) => {
			updateCalls.push(data);
			return existing as MarketplaceSource;
		},
		delete: async () => {},
		updateSyncStatus: async () => {},
	};
	return { repo, updateCalls };
}

// --- tests ---

describe("updateMarketplaceSource", () => {
	it("returns null when source does not exist", async () => {
		const { repo } = makeRepo(null);
		const result = await updateMarketplaceSource({ marketplaceSources: repo, audit }, "missing", {});
		expect(result).toBeNull();
	});

	it("passes importPluginsAndSkills: true when explicitly set", async () => {
		const { repo, updateCalls } = makeRepo();
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ importPluginsAndSkills: true },
		);
		expect(updateCalls[0].importPluginsAndSkills).toBe(true);
	});

	it("passes importPluginsAndSkills: false when explicitly set to false", async () => {
		const { repo, updateCalls } = makeRepo({
			...BASE_SOURCE,
			importPluginsAndSkills: true,
		});
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ importPluginsAndSkills: false },
		);
		expect(updateCalls[0].importPluginsAndSkills).toBe(false);
	});

	it("does NOT include importPluginsAndSkills in update when not provided", async () => {
		const { repo, updateCalls } = makeRepo();
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ gitUrl: "github.com/org/other" },
		);
		expect("importPluginsAndSkills" in updateCalls[0]).toBe(false);
	});

	it("clears accessToken when null is passed", async () => {
		const { repo, updateCalls } = makeRepo({
			...BASE_SOURCE,
			accessTokenEncrypted: "encrypted",
			hasToken: true,
		});
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ accessToken: null },
		);
		expect(updateCalls[0].accessTokenEncrypted).toBeNull();
	});

	it("encrypts new accessToken when a string is passed", async () => {
		const { repo, updateCalls } = makeRepo();
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ accessToken: "new-secret" },
		);
		expect(updateCalls[0].accessTokenEncrypted).not.toBeNull();
		expect(updateCalls[0].accessTokenEncrypted).not.toBe("new-secret");
	});

	it("does not touch accessToken when undefined is passed", async () => {
		const { repo, updateCalls } = makeRepo();
		await updateMarketplaceSource(
			{ marketplaceSources: repo, audit },
			"src-1",
			{ gitUrl: "github.com/org/other" },
		);
		expect("accessTokenEncrypted" in updateCalls[0]).toBe(false);
	});
});
