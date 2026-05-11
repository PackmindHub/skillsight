import { describe, expect, it } from "bun:test";
import type { AuditAction, AuditEntry } from "@/domain/audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { Skill, SkillStatus } from "@/domain/skill";
import {
	UPDATE_SKILLS_STATUS_MAX_BATCH,
	updateSkillsStatus,
} from "./update-skills-status";

type AuditCall = {
	actorEmail: string | null;
	action: AuditAction;
	target?: string | null;
	metadata?: Record<string, unknown>;
};

function makeSkill(overrides: Partial<Skill> = {}): Skill {
	return {
		skillName: "linting",
		pluginName: "",
		status: "to_review",
		firstSeenAt: new Date("2025-01-01"),
		lastSeenAt: new Date("2025-01-02"),
		...overrides,
	};
}

function makeDeps(seed: Skill[] = []) {
	const auditCalls: AuditCall[] = [];
	const store = new Map<string, Skill>();
	for (const s of seed) store.set(`${s.skillName}|${s.pluginName}`, s);
	let updateCallCount = 0;

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
		deleteByKeys: async () => 0,
		findByKey: async (key) => store.get(`${key.skillName}|${key.pluginName}`) ?? null,
		updateStatus: async (key, status) => {
			updateCallCount++;
			const k = `${key.skillName}|${key.pluginName}`;
			const existing = store.get(k);
			if (!existing) return null;
			const next: Skill = { ...existing, status, lastSeenAt: new Date() };
			store.set(k, next);
			return next;
		},
	};

	const audit: IAuditRepository = {
		log: async (entry) => {
			auditCalls.push(entry as AuditCall);
		},
		list: async () => ({ items: [] as AuditEntry[], total: 0 }),
		listAll: async () => [],
	};

	return {
		deps: { skills, audit },
		auditCalls,
		getUpdateCallCount: () => updateCallCount,
		getStore: () => store,
	};
}

describe("updateSkillsStatus", () => {
	it("rejects an empty list", async () => {
		const { deps, auditCalls } = makeDeps();
		const result = await updateSkillsStatus(deps, {
			entries: [],
			status: "approved",
			actorEmail: "u@x",
		});
		expect(result).toEqual({ error: "empty" });
		expect(auditCalls).toHaveLength(0);
	});

	it("rejects a list of blank skill names", async () => {
		const { deps } = makeDeps();
		const result = await updateSkillsStatus(deps, {
			entries: [
				{ skillName: "   ", pluginName: "" },
				{ skillName: "", pluginName: "p" },
			],
			status: "approved",
			actorEmail: "u@x",
		});
		expect(result).toEqual({ error: "empty" });
	});

	it("rejects an oversized batch", async () => {
		const { deps } = makeDeps();
		const entries = Array.from(
			{ length: UPDATE_SKILLS_STATUS_MAX_BATCH + 1 },
			(_, i) => ({ skillName: `s-${i}`, pluginName: "" }),
		);
		const result = await updateSkillsStatus(deps, {
			entries,
			status: "approved",
			actorEmail: "u@x",
		});
		expect(result).toEqual({ error: "too_many" });
	});

	it("updates orphan skills, skips plugin-owned, counts not-found", async () => {
		const { deps, auditCalls, getUpdateCallCount } = makeDeps([
			makeSkill({ skillName: "lint", pluginName: "", status: "to_review" }),
			makeSkill({ skillName: "fmt", pluginName: "", status: "to_review" }),
			makeSkill({ skillName: "owned", pluginName: "acme/x", status: "to_review" }),
		]);

		const result = await updateSkillsStatus(deps, {
			entries: [
				{ skillName: "lint", pluginName: "" },
				{ skillName: "fmt", pluginName: "" },
				{ skillName: "owned", pluginName: "acme/x" },
				{ skillName: "ghost", pluginName: "" },
			],
			status: "approved",
			actorEmail: "u@x",
		});

		expect(result).toEqual({ updated: 2, skippedInherited: 1, notFound: 1 });
		expect(getUpdateCallCount()).toBe(2);

		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("skills_status_changed");
		expect(auditCalls[0].actorEmail).toBe("u@x");
		expect(auditCalls[0].target).toBeNull();
		expect(auditCalls[0].metadata).toMatchObject({
			to: "approved",
			requested: 4,
			updated: 2,
			skippedInherited: 1,
			notFound: 1,
			scope: "bulk",
		});
	});

	it("does not write when the status already matches", async () => {
		const { deps, getUpdateCallCount } = makeDeps([
			makeSkill({ skillName: "lint", pluginName: "", status: "approved" }),
		]);

		const result = await updateSkillsStatus(deps, {
			entries: [{ skillName: "lint", pluginName: "" }],
			status: "approved",
			actorEmail: "u@x",
		});

		expect(result).toEqual({ updated: 0, skippedInherited: 0, notFound: 0 });
		expect(getUpdateCallCount()).toBe(0);
	});

	it("normalizes entries: trims names, defaults plugin to empty string, dedupes", async () => {
		const { deps, auditCalls } = makeDeps([
			makeSkill({ skillName: "lint", pluginName: "", status: "to_review" }),
		]);
		const result = await updateSkillsStatus(deps, {
			entries: [
				{ skillName: "  lint  ", pluginName: "" },
				{ skillName: "lint", pluginName: "" },
				{ skillName: "", pluginName: "ignored" },
			],
			status: "approved",
			actorEmail: "u@x",
		});

		expect(result).toEqual({ updated: 1, skippedInherited: 0, notFound: 0 });
		expect(auditCalls[0].metadata?.requested).toBe(1);
	});

	it("audit metadata truncates the skills list to 50 entries", async () => {
		const { deps, auditCalls } = makeDeps();
		const entries = Array.from({ length: 120 }, (_, i) => ({
			skillName: `s-${i}`,
			pluginName: "",
		}));
		await updateSkillsStatus(deps, { entries, status: "approved", actorEmail: "u@x" });

		expect((auditCalls[0].metadata?.skills as unknown[]).length).toBe(50);
		expect(auditCalls[0].metadata?.requested).toBe(120);
	});

	it("supports all skill statuses", async () => {
		const targets: SkillStatus[] = ["to_review", "approved", "removed"];
		for (const target of targets) {
			const { deps } = makeDeps([
				makeSkill({ skillName: "lint", pluginName: "", status: "to_review" }),
			]);
			const result = await updateSkillsStatus(deps, {
				entries: [{ skillName: "lint", pluginName: "" }],
				status: target,
				actorEmail: "u@x",
			});
			if ("error" in result) throw new Error("unexpected error");
			if (target === "to_review") {
				expect(result.updated).toBe(0); // already at target
			} else {
				expect(result.updated).toBe(1);
			}
		}
	});
});
