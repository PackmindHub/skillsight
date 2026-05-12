import type {
	CohortsWindow,
	IEventRepository,
	UserSkillActivation,
} from "@/domain/ports/event-repository";

export interface CohortMember {
	email: string;
	totalActivations: number;
	lastActiveAt: string;
	perSkill: Record<string, number>;
}

export interface Cohort {
	id: string;
	skills: string[];
	users: CohortMember[];
	activations: number;
	lastActiveAt: string;
}

export interface CohortsResponse {
	cohorts: Cohort[];
	windowDays: number | null;
	totalUsers: number;
	totalSkills: number;
}

export async function getCohorts(
	deps: { events: IEventRepository },
	input: { window: CohortsWindow },
): Promise<CohortsResponse> {
	const rows = await deps.events.listUserSkillActivations(input.window);
	const cohorts = buildCohorts(rows);
	const totalUsers = new Set(rows.map((r) => r.userEmail)).size;
	const totalSkills = new Set(rows.map((r) => r.skillName)).size;

	return {
		cohorts,
		windowDays: input.window === "all" ? null : input.window,
		totalUsers,
		totalSkills,
	};
}

export function buildCohorts(rows: UserSkillActivation[]): Cohort[] {
	const byUser = new Map<string, UserSkillActivation[]>();
	for (const row of rows) {
		const list = byUser.get(row.userEmail);
		if (list) list.push(row);
		else byUser.set(row.userEmail, [row]);
	}

	const byCombo = new Map<string, Cohort>();
	for (const [email, userRows] of byUser) {
		const firstRow = userRows[0];
		if (!firstRow) continue;
		const sortedSkills = userRows.map((r) => r.skillName).sort();
		const id = sortedSkills.join("|");

		const perSkill: Record<string, number> = {};
		let totalActivations = 0;
		let lastActivatedAt = firstRow.lastActivatedAt;
		for (const r of userRows) {
			perSkill[r.skillName] = r.activations;
			totalActivations += r.activations;
			if (r.lastActivatedAt > lastActivatedAt) lastActivatedAt = r.lastActivatedAt;
		}

		const member: CohortMember = {
			email,
			totalActivations,
			lastActiveAt: lastActivatedAt.toISOString(),
			perSkill,
		};

		let cohort = byCombo.get(id);
		if (!cohort) {
			cohort = {
				id,
				skills: sortedSkills,
				users: [],
				activations: 0,
				lastActiveAt: member.lastActiveAt,
			};
			byCombo.set(id, cohort);
		}
		cohort.users.push(member);
		cohort.activations += totalActivations;
		if (member.lastActiveAt > cohort.lastActiveAt) cohort.lastActiveAt = member.lastActiveAt;
	}

	return Array.from(byCombo.values()).sort(
		(a, b) => b.users.length - a.users.length || b.activations - a.activations,
	);
}
