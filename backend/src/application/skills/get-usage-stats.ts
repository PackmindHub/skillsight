import type { ISkillRepository, TimeWindow } from "@/domain/ports/skill-repository";

export async function getUsageStats(
	deps: { skills: ISkillRepository },
	input: { window: TimeWindow },
) {
	const [topSkills, dailyTrend, topUsers, byTrigger, totalActivations, uniqueSkills, activeUsers] =
		await Promise.all([
			deps.skills.getTopSkills(input.window),
			deps.skills.getDailyTrend(input.window),
			deps.skills.getTopUsers(input.window),
			deps.skills.getByTrigger(input.window),
			deps.skills.getTotalActivations(input.window),
			deps.skills.getUniqueSkillsCount(input.window),
			deps.skills.getActiveUsersCount(input.window),
		]);

	return {
		topSkills,
		dailyTrend,
		topUsers,
		byTrigger,
		stats: { totalActivations, uniqueSkills, activeUsers },
	};
}
