import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Marketplace } from "@/domain/marketplace";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import { eventBus, type MarketplaceStatusChangedEvent } from "@/lib/event-bus";
import {
	UPDATE_MARKETPLACES_STATUS_MAX_BATCH,
	updateMarketplacesStatus,
} from "./update-marketplaces-status";

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
	const state = new Map(initial.map((m) => [m.name, { ...m }]));
	const updateCalls: Array<{ name: string; data: Partial<Marketplace> }> = [];
	const repo: IMarketplaceRepository = {
		listWithStats: async () => [],
		findByName: async (name) => state.get(name) ?? null,
		delete: async () => false,
		update: async (name, data) => {
			updateCalls.push({ name, data });
			const existing = state.get(name);
			if (!existing) throw new Error("not found");
			const updated = { ...existing, ...data };
			state.set(name, updated);
			return updated;
		},
		upsertSeen: async () => {},
		upsertFromImport: async () => {},
		listStatuses: async () => [],
		listPluginsForMarketplace: async () => [],
		listSkillsForMarketplace: async () => [],
	};
	return { repo, state, updateCalls };
}

function makeMarketplace(name: string, status: Marketplace["status"] = "to_review"): Marketplace {
	return {
		name,
		status,
		url: null,
		description: null,
		firstSeenAt: new Date(),
		lastSeenAt: new Date(),
	};
}

describe("updateMarketplacesStatus", () => {
	let emitted: MarketplaceStatusChangedEvent[];
	let listener: (p: MarketplaceStatusChangedEvent) => void;

	beforeEach(() => {
		emitted = [];
		listener = (p) => {
			emitted.push(p);
		};
		eventBus.onMarketplaceStatusChanged(listener);
	});

	afterEach(() => {
		eventBus.off("marketplace:statusChanged", listener);
	});

	it("returns 'empty' when no names are provided", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo } = makeMarketplaceRepo([]);

		const result = await updateMarketplacesStatus(
			{ marketplaces: repo, audit },
			{ names: ["", "  "], status: "approved", actorEmail: null },
		);

		expect(result).toEqual({ error: "empty" });
		expect(auditCalls).toEqual([]);
	});

	it("returns 'too_many' when more than the batch cap are provided", async () => {
		const { audit } = makeAudit();
		const { repo } = makeMarketplaceRepo([]);
		const names = Array.from(
			{ length: UPDATE_MARKETPLACES_STATUS_MAX_BATCH + 1 },
			(_, i) => `mp-${i}`,
		);
		const result = await updateMarketplacesStatus(
			{ marketplaces: repo, audit },
			{ names, status: "approved", actorEmail: null },
		);
		expect(result).toEqual({ error: "too_many" });
	});

	it("updates status, dedupes input, records one audit row, emits one event per changed marketplace", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo, state, updateCalls } = makeMarketplaceRepo([
			makeMarketplace("mp-a", "to_review"),
			makeMarketplace("mp-b", "to_review"),
		]);

		const result = await updateMarketplacesStatus(
			{ marketplaces: repo, audit },
			{
				names: ["mp-a", " mp-a ", "mp-b"],
				status: "approved",
				actorEmail: "admin@example.com",
			},
		);

		expect(result).toEqual({ updated: 2, notFound: 0, unchanged: 0 });
		expect(state.get("mp-a")?.status).toBe("approved");
		expect(state.get("mp-b")?.status).toBe("approved");
		expect(updateCalls).toEqual([
			{ name: "mp-a", data: { status: "approved" } },
			{ name: "mp-b", data: { status: "approved" } },
		]);
		expect(emitted.map((e) => e.name)).toEqual(["mp-a", "mp-b"]);
		expect(emitted.every((e) => e.newStatus === "approved")).toBe(true);
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("marketplaces_status_changed");
		expect(auditCalls[0].actorEmail).toBe("admin@example.com");
		expect(auditCalls[0].metadata).toMatchObject({
			to: "approved",
			requested: 2,
			updated: 2,
			notFound: 0,
			unchanged: 0,
			scope: "bulk",
		});
	});

	it("skips marketplaces already at the target status (unchanged counter)", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo, updateCalls } = makeMarketplaceRepo([
			makeMarketplace("mp-a", "approved"),
			makeMarketplace("mp-b", "to_review"),
		]);

		const result = await updateMarketplacesStatus(
			{ marketplaces: repo, audit },
			{ names: ["mp-a", "mp-b"], status: "approved", actorEmail: null },
		);

		expect(result).toEqual({ updated: 1, notFound: 0, unchanged: 1 });
		expect(updateCalls).toEqual([{ name: "mp-b", data: { status: "approved" } }]);
		expect(emitted.map((e) => e.name)).toEqual(["mp-b"]);
		expect(auditCalls[0].metadata).toMatchObject({ updated: 1, unchanged: 1 });
	});

	it("counts not_found for unknown marketplaces, without emitting events for them", async () => {
		const { audit, calls: auditCalls } = makeAudit();
		const { repo } = makeMarketplaceRepo([makeMarketplace("mp-a", "to_review")]);

		const result = await updateMarketplacesStatus(
			{ marketplaces: repo, audit },
			{ names: ["mp-a", "missing"], status: "denied", actorEmail: null },
		);

		expect(result).toEqual({ updated: 1, notFound: 1, unchanged: 0 });
		expect(emitted.map((e) => e.name)).toEqual(["mp-a"]);
		expect(auditCalls[0].metadata).toMatchObject({ notFound: 1, updated: 1 });
	});
});
