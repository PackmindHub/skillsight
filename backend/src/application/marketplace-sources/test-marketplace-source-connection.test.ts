import { describe, expect, it } from "bun:test";
import { testMarketplaceSourceConnection } from "./test-marketplace-source-connection";
import type { MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type {
	IGitMarketplaceGateway,
	MarketplaceJsonData,
} from "@/domain/ports/git-marketplace-gateway";
import type { IPackmindCliGateway } from "@/domain/ports/packmind-cli-gateway";
import { encrypt } from "@/infrastructure/crypto/encrypt";

const BASE_SOURCE: MarketplaceSourceWithSecret = {
	id: "src-1",
	kind: "git",
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

const STUB_PACKMIND: IPackmindCliGateway = {
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

const BASE_DATA: MarketplaceJsonData = {
	name: "acme-marketplace",
	description: "an acme marketplace",
	plugins: [
		{ name: "plugin-a", version: "1.0.0" },
		{ name: "plugin-b", version: "2.0.0" },
	],
};

function makeRepo(existing: MarketplaceSourceWithSecret | null = null) {
	const repo: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => existing,
		create: async () => BASE_SOURCE,
		update: async () => BASE_SOURCE,
		delete: async () => {},
		updateSyncStatus: async () => {},
	};
	return repo;
}

function makeGateway(
	result: MarketplaceJsonData | { throw: string } = BASE_DATA,
) {
	const calls: Array<{ gitUrl: string; accessToken?: string; branch?: string }> = [];
	const gateway: IGitMarketplaceGateway = {
		fetchMarketplaceJson: async (params) => {
			calls.push(params);
			if ("throw" in result) throw new Error(result.throw);
			return result;
		},
	};
	return { gateway, calls };
}

describe("testMarketplaceSourceConnection", () => {
	it("returns ok with name and pluginCount on success", async () => {
		const { gateway } = makeGateway();
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: gateway, packmindCli: STUB_PACKMIND },
			{ gitUrl: "github.com/org/repo" },
		);
		expect(result).toEqual({
			ok: true,
			kind: "git",
			name: "acme-marketplace",
			description: "an acme marketplace",
			pluginCount: 2,
			skillCount: 0,
		});
	});

	it("counts skills declared inline in marketplace.json plugins", async () => {
		const { gateway } = makeGateway({
			name: "acme",
			plugins: [
				{ name: "plugin-a", skills: ["skill-1", "skill-2"] },
				{ name: "plugin-b", skills: ["skill-3"] },
				{ name: "plugin-c" },
			],
		});
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: gateway, packmindCli: STUB_PACKMIND },
			{ gitUrl: "github.com/org/repo" },
		);
		expect(result).toEqual({
			ok: true,
			kind: "git",
			name: "acme",
			description: undefined,
			pluginCount: 3,
			skillCount: 3,
		});
	});

	it("returns ok:false with the gateway error message when fetch throws", async () => {
		const { gateway } = makeGateway({ throw: "Authentication failed (HTTP 401). Check the access token." });
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: gateway, packmindCli: STUB_PACKMIND },
			{ gitUrl: "github.com/org/repo", accessToken: "bad" },
		);
		expect(result).toEqual({
			ok: false,
			error: "Authentication failed (HTTP 401). Check the access token.",
		});
	});

	it("uses the stored token when accessToken is blank and sourceId is provided", async () => {
		const stored = encrypt("stored-secret");
		const { gateway, calls } = makeGateway();
		await testMarketplaceSourceConnection(
			{
				marketplaceSources: makeRepo({ ...BASE_SOURCE, accessTokenEncrypted: stored, hasToken: true }),
				gitMarketplace: gateway,
				packmindCli: STUB_PACKMIND,
			},
			{ gitUrl: "github.com/org/repo", accessToken: "", sourceId: "src-1" },
		);
		expect(calls[0].accessToken).toBe("stored-secret");
	});

	it("prefers the provided accessToken over the stored one", async () => {
		const stored = encrypt("stored-secret");
		const { gateway, calls } = makeGateway();
		await testMarketplaceSourceConnection(
			{
				marketplaceSources: makeRepo({ ...BASE_SOURCE, accessTokenEncrypted: stored, hasToken: true }),
				gitMarketplace: gateway,
				packmindCli: STUB_PACKMIND,
			},
			{ gitUrl: "github.com/org/repo", accessToken: "new-token", sourceId: "src-1" },
		);
		expect(calls[0].accessToken).toBe("new-token");
	});

	it("calls the gateway without a token when neither accessToken nor sourceId is provided", async () => {
		const { gateway, calls } = makeGateway();
		await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: gateway, packmindCli: STUB_PACKMIND },
			{ gitUrl: "github.com/org/repo" },
		);
		expect(calls[0].accessToken).toBeUndefined();
	});

	it("forwards the branch parameter", async () => {
		const { gateway, calls } = makeGateway();
		await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: gateway, packmindCli: STUB_PACKMIND },
			{ gitUrl: "github.com/org/repo", branch: "develop" },
		);
		expect(calls[0].branch).toBe("develop");
	});
});

describe("testMarketplaceSourceConnection — packmind kind", () => {
	const makePackmind = (
		result:
			| { user: string; org: string; host: string }
			| { throw: string } = { user: "u@x", org: "Acme", host: "https://app.packmind.ai" },
	) => {
		const calls: Array<{ apiKey: string }> = [];
		const cli: IPackmindCliGateway = {
			whoami: async (apiKey: string) => {
				calls.push({ apiKey });
				if ("throw" in result) throw new Error(result.throw);
				return result;
			},
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
		return { cli, calls };
	};

	it("returns ok with user/org/host when the supplied apiKey is valid", async () => {
		const { cli, calls } = makePackmind();
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: makeGateway().gateway, packmindCli: cli },
			{ kind: "packmind", apiKey: "live-key" },
		);
		expect(result).toEqual({
			ok: true,
			kind: "packmind",
			user: "u@x",
			org: "Acme",
			host: "https://app.packmind.ai",
		});
		expect(calls[0].apiKey).toBe("live-key");
	});

	it("uses the stored encrypted apiKey when blank and sourceId is provided", async () => {
		const stored = encrypt("stored-packmind-key");
		const { cli, calls } = makePackmind();
		await testMarketplaceSourceConnection(
			{
				marketplaceSources: makeRepo({
					...BASE_SOURCE,
					kind: "packmind",
					gitUrl: null,
					marketplaceName: "Packmind",
					accessTokenEncrypted: stored,
					hasToken: true,
				}),
				gitMarketplace: makeGateway().gateway,
				packmindCli: cli,
				},
			{ kind: "packmind", sourceId: "src-1" },
		);
		expect(calls[0].apiKey).toBe("stored-packmind-key");
	});

	it("returns ok:false with a friendly error when no apiKey is supplied at all", async () => {
		const { cli } = makePackmind();
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: makeGateway().gateway, packmindCli: cli },
			{ kind: "packmind" },
		);
		expect(result).toEqual({ ok: false, error: "Packmind API key is required" });
	});

	it("returns ok:false with the gateway error message when whoami fails", async () => {
		const { cli } = makePackmind({ throw: "Packmind: not authenticated (check the API key)" });
		const result = await testMarketplaceSourceConnection(
			{ marketplaceSources: makeRepo(), gitMarketplace: makeGateway().gateway, packmindCli: cli },
			{ kind: "packmind", apiKey: "bad" },
		);
		expect(result).toEqual({
			ok: false,
			error: "Packmind: not authenticated (check the API key)",
		});
	});
});
