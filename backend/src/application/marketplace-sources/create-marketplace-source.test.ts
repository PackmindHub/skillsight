import { describe, expect, it } from "bun:test";
import { createMarketplaceSource } from "./create-marketplace-source";
import type { MarketplaceSource } from "@/domain/marketplace-source";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";

// --- helpers ---

const BASE_RESULT: MarketplaceSource = {
	id: "src-1",
	gitUrl: "github.com/org/repo",
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

function makeRepo() {
	const calls: Array<Parameters<IMarketplaceSourceRepository["create"]>[0]> = [];
	const repo: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => null,
		create: async (data) => {
			calls.push(data);
			return { ...BASE_RESULT, ...data, hasToken: !!data.accessTokenEncrypted };
		},
		update: async () => BASE_RESULT,
		delete: async () => {},
		updateSyncStatus: async () => {},
	};
	return { repo, calls };
}

// --- tests ---

describe("createMarketplaceSource", () => {
	it("defaults importPluginsAndSkills to false when not provided", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource({ marketplaceSources: repo }, { gitUrl: "github.com/org/repo" });
		expect(calls[0].importPluginsAndSkills).toBe(false);
	});

	it("passes importPluginsAndSkills: true when explicitly set", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource(
			{ marketplaceSources: repo },
			{ gitUrl: "github.com/org/repo", importPluginsAndSkills: true },
		);
		expect(calls[0].importPluginsAndSkills).toBe(true);
	});

	it("defaults syncIntervalMs to 3600000 when not provided", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource({ marketplaceSources: repo }, { gitUrl: "github.com/org/repo" });
		expect(calls[0].syncIntervalMs).toBe(3600000);
	});

	it("defaults enabled to true when not provided", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource({ marketplaceSources: repo }, { gitUrl: "github.com/org/repo" });
		expect(calls[0].enabled).toBe(true);
	});

	it("encrypts accessToken when provided (non-null accessTokenEncrypted)", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource(
			{ marketplaceSources: repo },
			{ gitUrl: "github.com/org/repo", accessToken: "secret" },
		);
		expect(calls[0].accessTokenEncrypted).not.toBeNull();
		expect(calls[0].accessTokenEncrypted).not.toBe("secret");
	});

	it("passes null accessTokenEncrypted when no accessToken given", async () => {
		const { repo, calls } = makeRepo();
		await createMarketplaceSource({ marketplaceSources: repo }, { gitUrl: "github.com/org/repo" });
		expect(calls[0].accessTokenEncrypted).toBeNull();
	});
});
