import { describe, expect, test } from "bun:test";
import { buildCohorts, getCohorts } from "./get-cohorts";
import type {
	CohortsWindow,
	IEventRepository,
	UserSkillActivation,
} from "@/domain/ports/event-repository";

function row(
	userEmail: string,
	skillName: string,
	activations: number,
	lastActivatedAt: string,
): UserSkillActivation {
	return { userEmail, skillName, activations, lastActivatedAt: new Date(lastActivatedAt) };
}

describe("buildCohorts", () => {
	test("groups users sharing the exact same skill set", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 10, "2026-05-10T00:00:00Z"),
			row("a@x", "docx", 5, "2026-05-11T00:00:00Z"),
			row("b@x", "pdf", 3, "2026-05-09T00:00:00Z"),
			row("b@x", "docx", 7, "2026-05-12T00:00:00Z"),
			row("c@x", "pdf", 1, "2026-05-08T00:00:00Z"),
		];

		const cohorts = buildCohorts(rows);

		expect(cohorts).toHaveLength(2);

		const docsCohort = cohorts.find((c) => c.skills.length === 2);
		expect(docsCohort).toBeDefined();
		expect(docsCohort?.skills).toEqual(["docx", "pdf"]);
		expect(docsCohort?.users.map((u) => u.email).sort()).toEqual(["a@x", "b@x"]);
		expect(docsCohort?.activations).toBe(10 + 5 + 3 + 7);
		expect(docsCohort?.lastActiveAt).toBe(new Date("2026-05-12T00:00:00Z").toISOString());

		const solo = cohorts.find((c) => c.skills.length === 1);
		expect(solo?.users.map((u) => u.email)).toEqual(["c@x"]);
	});

	test("returned cohorts are sorted by user count then activations", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "alpha", 5, "2026-01-01T00:00:00Z"),
			row("b@x", "beta", 5, "2026-01-01T00:00:00Z"),
			row("c@x", "beta", 5, "2026-01-01T00:00:00Z"),
			row("d@x", "beta", 5, "2026-01-01T00:00:00Z"),
		];

		const cohorts = buildCohorts(rows);
		expect(cohorts[0]?.users.length).toBe(3);
		expect(cohorts[1]?.users.length).toBe(1);
	});

	test("perSkill records each user's activation count", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 10, "2026-05-10T00:00:00Z"),
			row("a@x", "docx", 5, "2026-05-11T00:00:00Z"),
		];
		const [cohort] = buildCohorts(rows);
		const user = cohort?.users[0];
		expect(user?.perSkill).toEqual({ pdf: 10, docx: 5 });
		expect(user?.totalActivations).toBe(15);
	});

	test("empty input produces no cohorts", () => {
		expect(buildCohorts([])).toEqual([]);
	});

	test("single-skill users form their own one-skill cohort", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 3, "2026-05-10T00:00:00Z"),
			row("b@x", "pdf", 4, "2026-05-11T00:00:00Z"),
		];
		const cohorts = buildCohorts(rows);
		expect(cohorts).toHaveLength(1);
		expect(cohorts[0]?.skills).toEqual(["pdf"]);
		expect(cohorts[0]?.users).toHaveLength(2);
	});

	test("two users with overlapping but not identical skills are separate cohorts", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 1, "2026-05-10T00:00:00Z"),
			row("a@x", "docx", 1, "2026-05-10T00:00:00Z"),
			row("b@x", "pdf", 1, "2026-05-10T00:00:00Z"),
			row("b@x", "xlsx", 1, "2026-05-10T00:00:00Z"),
		];
		const cohorts = buildCohorts(rows);
		expect(cohorts).toHaveLength(2);
		const skillSets = cohorts.map((c) => c.skills.join(","));
		expect(skillSets.sort()).toEqual(["docx,pdf", "pdf,xlsx"]);
	});

	test("lastActiveAt is the most recent across users in the cohort", () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 1, "2026-05-01T00:00:00Z"),
			row("a@x", "docx", 1, "2026-05-02T00:00:00Z"),
			row("b@x", "pdf", 1, "2026-05-09T00:00:00Z"),
			row("b@x", "docx", 1, "2026-04-30T00:00:00Z"),
		];
		const [cohort] = buildCohorts(rows);
		expect(cohort?.lastActiveAt).toBe(new Date("2026-05-09T00:00:00Z").toISOString());
	});
});

describe("getCohorts", () => {
	function makeEvents(rows: UserSkillActivation[]): IEventRepository {
		return {
			insertMany: async () => {},
			deleteByIntegrationId: async () => {},
			deleteBySkillKeys: async () => 0,
			listRecentSkillActivations: async () => [],
			listUserSkillActivations: async () => rows,
		};
	}

	test("response totals reflect distinct users and skills", async () => {
		const rows: UserSkillActivation[] = [
			row("a@x", "pdf", 5, "2026-05-10T00:00:00Z"),
			row("a@x", "docx", 5, "2026-05-10T00:00:00Z"),
			row("b@x", "pdf", 5, "2026-05-10T00:00:00Z"),
			row("b@x", "docx", 5, "2026-05-10T00:00:00Z"),
			row("c@x", "xlsx", 5, "2026-05-10T00:00:00Z"),
		];
		const res = await getCohorts({ events: makeEvents(rows) }, { window: 30 });
		expect(res.totalUsers).toBe(3);
		expect(res.totalSkills).toBe(3);
		expect(res.windowDays).toBe(30);
		expect(res.cohorts).toHaveLength(2);
	});

	test("windowDays is null when window is 'all'", async () => {
		const res = await getCohorts({ events: makeEvents([]) }, { window: "all" });
		expect(res.windowDays).toBeNull();
		expect(res.cohorts).toEqual([]);
		expect(res.totalUsers).toBe(0);
		expect(res.totalSkills).toBe(0);
	});

	test("forwards the window value to the repository", async () => {
		let received: CohortsWindow | null = null;
		const events: IEventRepository = {
			insertMany: async () => {},
			deleteByIntegrationId: async () => {},
			deleteBySkillKeys: async () => 0,
			listRecentSkillActivations: async () => [],
			listUserSkillActivations: async (w) => {
				received = w;
				return [];
			},
		};
		await getCohorts({ events }, { window: 90 });
		expect(received).toBe(90);
	});
});
