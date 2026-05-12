import { describe, expect, it } from "bun:test";
import type { AuditAction, AuditEntry } from "@/domain/audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { DELETE_SKILLS_MAX_BATCH, deleteSkills } from "./delete-skills";

type AuditCall = {
	actorEmail: string | null;
	action: AuditAction;
	target?: string | null;
	metadata?: Record<string, unknown>;
};

function makeDeps(overrides?: {
	skillsDeletedReturn?: number;
	eventsDeletedReturn?: number;
	throwOnSkills?: boolean;
}) {
	const skillsCalls: Array<Array<{ skillName: string; pluginName: string }>> = [];
	const eventsCalls: Array<Array<{ skillName: string; pluginName: string }>> = [];
	const auditCalls: AuditCall[] = [];

	const skills: ISkillRepository = {
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
		deleteByPlugins: async () => {},
		deleteByKeys: async (entries) => {
			skillsCalls.push(entries);
			if (overrides?.throwOnSkills) throw new Error("boom");
			return overrides?.skillsDeletedReturn ?? entries.length;
		},
		findByKey: async () => null,
		updateStatus: async () => null,
	};

	const events: IEventRepository = {
		insertMany: async () => {},
		deleteByIntegrationId: async () => {},
		deleteBySkillKeys: async (entries) => {
			eventsCalls.push(entries);
			return overrides?.eventsDeletedReturn ?? entries.length * 3;
		},
		listRecentSkillActivations: async () => [],
		listUserSkillActivations: async () => [],
	};

	const audit: IAuditRepository = {
		log: async (entry) => {
			auditCalls.push(entry as AuditCall);
		},
		list: async () => ({ items: [] as AuditEntry[], total: 0 }),
		listAll: async () => [],
	};

	return { deps: { skills, events, audit }, skillsCalls, eventsCalls, auditCalls };
}

describe("deleteSkills", () => {
	it("rejects an empty list", async () => {
		const { deps, skillsCalls, eventsCalls, auditCalls } = makeDeps();
		const result = await deleteSkills(deps, { entries: [], actorEmail: "u@x" });
		expect(result).toEqual({ error: "empty" });
		expect(skillsCalls).toHaveLength(0);
		expect(eventsCalls).toHaveLength(0);
		expect(auditCalls).toHaveLength(0);
	});

	it("rejects a list with only blank skill names", async () => {
		const { deps } = makeDeps();
		const result = await deleteSkills(deps, {
			entries: [
				{ skillName: "   ", pluginName: "p" },
				{ skillName: "", pluginName: "" },
			],
			actorEmail: "u@x",
		});
		expect(result).toEqual({ error: "empty" });
	});

	it("rejects an oversized batch", async () => {
		const { deps } = makeDeps();
		const entries = Array.from({ length: DELETE_SKILLS_MAX_BATCH + 1 }, (_, i) => ({
			skillName: `skill-${i}`,
			pluginName: "p",
		}));
		const result = await deleteSkills(deps, { entries, actorEmail: "u@x" });
		expect(result).toEqual({ error: "too_many" });
	});

	it("deletes events first, then skill rows", async () => {
		const callOrder: string[] = [];
		const skills: ISkillRepository = {
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
			deleteByPlugins: async () => {},
			deleteByKeys: async () => {
				callOrder.push("skills");
				return 1;
			},
			findByKey: async () => null,
			updateStatus: async () => null,
		};
		const events: IEventRepository = {
			insertMany: async () => {},
			deleteByIntegrationId: async () => {},
			deleteBySkillKeys: async () => {
				callOrder.push("events");
				return 5;
			},
			listRecentSkillActivations: async () => [],
		listUserSkillActivations: async () => [],
		};
		const audit: IAuditRepository = {
			log: async () => {},
			list: async () => ({ items: [], total: 0 }),
			listAll: async () => [],
		};

		await deleteSkills(
			{ skills, events, audit },
			{ entries: [{ skillName: "linting", pluginName: "p" }], actorEmail: "u@x" },
		);

		expect(callOrder).toEqual(["events", "skills"]);
	});

	it("normalizes entries: trims names, defaults plugin to empty string, dedupes", async () => {
		const { deps, skillsCalls, eventsCalls } = makeDeps();
		await deleteSkills(deps, {
			entries: [
				{ skillName: "  linting  ", pluginName: "acme/lint" },
				{ skillName: "linting", pluginName: "acme/lint" }, // duplicate
				{ skillName: "phantom", pluginName: "" },
				{ skillName: "", pluginName: "ignored" }, // blank — dropped
			],
			actorEmail: "u@x",
		});

		expect(skillsCalls[0]).toEqual([
			{ skillName: "linting", pluginName: "acme/lint" },
			{ skillName: "phantom", pluginName: "" },
		]);
		expect(eventsCalls[0]).toEqual(skillsCalls[0]);
	});

	it("returns the count from each repository and emits a single audit entry", async () => {
		const { deps, auditCalls } = makeDeps({
			skillsDeletedReturn: 2,
			eventsDeletedReturn: 17,
		});
		const result = await deleteSkills(deps, {
			entries: [
				{ skillName: "a", pluginName: "p" },
				{ skillName: "b", pluginName: "p" },
			],
			actorEmail: "u@x",
		});

		expect(result).toEqual({ skillsDeleted: 2, eventsDeleted: 17 });
		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("skills_deleted");
		expect(auditCalls[0].actorEmail).toBe("u@x");
		expect(auditCalls[0].target).toBeNull();
		expect(auditCalls[0].metadata).toMatchObject({
			requested: 2,
			skillsDeleted: 2,
			eventsDeleted: 17,
			skills: [
				{ skillName: "a", pluginName: "p" },
				{ skillName: "b", pluginName: "p" },
			],
		});
	});

	it("audit metadata truncates the skills list to 50 entries", async () => {
		const { deps, auditCalls } = makeDeps();
		const entries = Array.from({ length: 120 }, (_, i) => ({
			skillName: `s-${i}`,
			pluginName: "p",
		}));
		await deleteSkills(deps, { entries, actorEmail: "u@x" });

		expect((auditCalls[0].metadata?.skills as unknown[]).length).toBe(50);
		expect(auditCalls[0].metadata?.requested).toBe(120);
	});

	it("audit failure does not surface — mutation succeeds", async () => {
		const skills: ISkillRepository = {
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
			deleteByPlugins: async () => {},
			deleteByKeys: async () => 1,
			findByKey: async () => null,
			updateStatus: async () => null,
		};
		const events: IEventRepository = {
			insertMany: async () => {},
			deleteByIntegrationId: async () => {},
			deleteBySkillKeys: async () => 1,
			listRecentSkillActivations: async () => [],
		listUserSkillActivations: async () => [],
		};
		const audit: IAuditRepository = {
			log: async () => {
				throw new Error("audit-down");
			},
			list: async () => ({ items: [], total: 0 }),
			listAll: async () => [],
		};

		const result = await deleteSkills(
			{ skills, events, audit },
			{ entries: [{ skillName: "x", pluginName: "p" }], actorEmail: "u@x" },
		);
		expect(result).toEqual({ skillsDeleted: 1, eventsDeleted: 1 });
	});
});
