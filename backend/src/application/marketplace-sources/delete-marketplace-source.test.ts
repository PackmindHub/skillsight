import { describe, expect, it } from "bun:test";
import { deleteMarketplaceSource } from "./delete-marketplace-source";
import type { MarketplaceSource, MarketplaceSourceWithSecret } from "@/domain/marketplace-source";
import type { IMarketplaceSourceRepository } from "@/domain/ports/marketplace-source-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";

type AuditCall = Parameters<IAuditRepository["log"]>[0];

const BASE_SOURCE: MarketplaceSourceWithSecret = {
	id: "src-1",
	gitUrl: "github.com/org/repo",
	accessTokenEncrypted: null,
	hasToken: false,
	branch: "main",
	marketplaceName: "acme",
	syncIntervalMs: 3600000,
	enabled: true,
	importPluginsAndSkills: false,
	lastSyncAt: null,
	lastSyncError: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function makeDeps(existing: MarketplaceSourceWithSecret | null = BASE_SOURCE) {
	const deleteCalls: string[] = [];
	const auditCalls: AuditCall[] = [];

	const marketplaceSources: IMarketplaceSourceRepository = {
		findAll: async () => [],
		findById: async () => existing,
		findByMarketplaceName: async () => [],
		create: async () => existing as MarketplaceSource,
		update: async () => existing as MarketplaceSource,
		delete: async (id) => {
			deleteCalls.push(id);
		},
		updateSyncStatus: async () => {},
	};

	const audit: IAuditRepository = {
		log: async (entry) => {
			auditCalls.push(entry);
		},
		list: async () => ({ items: [], total: 0 }),
		listAll: async () => [],
	};

	return { deps: { marketplaceSources, audit }, deleteCalls, auditCalls };
}

describe("deleteMarketplaceSource", () => {
	it("returns false and does not call delete or audit when source is missing", async () => {
		const { deps, deleteCalls, auditCalls } = makeDeps(null);

		const result = await deleteMarketplaceSource(deps, "missing", { actorEmail: "u@x" });

		expect(result).toBe(false);
		expect(deleteCalls).toHaveLength(0);
		expect(auditCalls).toHaveLength(0);
	});

	it("deletes the source and records an audit entry on success", async () => {
		const { deps, deleteCalls, auditCalls } = makeDeps();

		const result = await deleteMarketplaceSource(deps, "src-1", { actorEmail: "u@x" });

		expect(result).toBe(true);
		expect(deleteCalls).toEqual(["src-1"]);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("marketplace_source_deleted");
		expect(auditCalls[0].target).toBe("src-1");
		expect(auditCalls[0].actorEmail).toBe("u@x");
		expect(auditCalls[0].metadata).toEqual({
			gitUrl: BASE_SOURCE.gitUrl,
			branch: BASE_SOURCE.branch,
			marketplaceName: BASE_SOURCE.marketplaceName,
		});
	});

	it("defaults actorEmail to null when not provided", async () => {
		const { deps, auditCalls } = makeDeps();

		await deleteMarketplaceSource(deps, "src-1");

		expect(auditCalls[0].actorEmail).toBeNull();
	});
});
