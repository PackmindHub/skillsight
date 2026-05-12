import { describe, expect, it } from "bun:test";
import type { AuditEntry } from "@/domain/audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { Skill, SkillStatus } from "@/domain/skill";
import { updateSkillStatus } from "./update-skill-status";

type AuditCall = Parameters<IAuditRepository["log"]>[0];

function makeDeps(initial: Skill | null) {
	const auditCalls: AuditCall[] = [];
	let current = initial;
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
		findByKey: async () => current,
		updateStatus: async (_key, status) => {
			updateCallCount++;
			if (!current) return null;
			current = { ...current, status, lastSeenAt: new Date() };
			return current;
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
		getCurrent: () => current,
	};
}

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

describe("updateSkillStatus", () => {
	it("updates a plugin-less skill and emits an audit entry", async () => {
		const { deps, auditCalls } = makeDeps(makeSkill({ status: "to_review" }));

		const result = await updateSkillStatus(deps, {
			skillName: "linting",
			pluginName: "",
			status: "approved",
			actorEmail: "u@x",
		});

		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.status).toBe("approved");

		expect(auditCalls).toHaveLength(1);
		expect(auditCalls[0].action).toBe("skill_status_changed");
		expect(auditCalls[0].actorEmail).toBe("u@x");
		expect(auditCalls[0].target).toBe("linting");
		expect(auditCalls[0].metadata).toEqual({
			from: "to_review",
			to: "approved",
			pluginName: "",
			scope: "direct",
		});
	});

	it("rejects update for a skill attached to a plugin", async () => {
		const { deps, auditCalls, getUpdateCallCount } = makeDeps(
			makeSkill({ pluginName: "acme/lint", status: "to_review" }),
		);

		const result = await updateSkillStatus(deps, {
			skillName: "linting",
			pluginName: "acme/lint",
			status: "approved",
			actorEmail: "u@x",
		});

		expect(result).toEqual({ error: "not_editable" });
		expect(auditCalls).toHaveLength(0);
		expect(getUpdateCallCount()).toBe(0);
	});

	it("returns not_found when the skill does not exist", async () => {
		const { deps, auditCalls, getUpdateCallCount } = makeDeps(null);

		const result = await updateSkillStatus(deps, {
			skillName: "missing",
			pluginName: "",
			status: "approved",
			actorEmail: "u@x",
		});

		expect(result).toEqual({ error: "not_found" });
		expect(auditCalls).toHaveLength(0);
		expect(getUpdateCallCount()).toBe(0);
	});

	it("is a no-op when the status is unchanged", async () => {
		const { deps, auditCalls, getUpdateCallCount } = makeDeps(
			makeSkill({ status: "approved" }),
		);

		const result = await updateSkillStatus(deps, {
			skillName: "linting",
			pluginName: "",
			status: "approved",
			actorEmail: "u@x",
		});

		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.status).toBe("approved");
		expect(auditCalls).toHaveLength(0);
		expect(getUpdateCallCount()).toBe(0);
	});

	it("supports all skill statuses", async () => {
		const targets: SkillStatus[] = ["to_review", "approved", "removed", "ignored"];
		for (const target of targets) {
			const { deps } = makeDeps(makeSkill({ status: "to_review" }));
			const result = await updateSkillStatus(deps, {
				skillName: "linting",
				pluginName: "",
				status: target,
				actorEmail: "u@x",
			});
			expect("error" in result).toBe(false);
			if (!("error" in result)) expect(result.status).toBe(target);
		}
	});
});
