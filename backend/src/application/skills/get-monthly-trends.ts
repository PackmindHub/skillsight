import type { ISkillRepository, MonthlyTrends } from "@/domain/ports/skill-repository";

export async function getMonthlyTrends(deps: { skills: ISkillRepository }): Promise<MonthlyTrends> {
	return deps.skills.getMonthlyTrends();
}
