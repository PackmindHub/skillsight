import type { DaysWindow, ISkillRepository } from "@/domain/ports/skill-repository";

export async function getUsageStats(
	deps: { skills: ISkillRepository },
	input: { days: DaysWindow },
) {
	const [topSkills, dailyTrend, topUsers, byTrigger, totalActivations, uniqueSkills, activeUsers] =
		await Promise.all([
			deps.skills.getTopSkills(input.days),
			deps.skills.getDailyTrend(input.days),
			deps.skills.getTopUsers(input.days),
			deps.skills.getByTrigger(input.days),
			deps.skills.getTotalActivations(input.days),
			deps.skills.getUniqueSkillsCount(input.days),
			deps.skills.getActiveUsersCount(input.days),
		]);

	return {
		topSkills,
		dailyTrend,
		topUsers,
		byTrigger,
		stats: { totalActivations, uniqueSkills, activeUsers },
	};
}
