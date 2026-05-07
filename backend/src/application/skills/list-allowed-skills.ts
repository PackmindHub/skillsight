import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { AllowedSkill } from "@/domain/skill";

export async function listAllowedSkills(
	deps: { skills: ISkillRepository },
): Promise<AllowedSkill[]> {
	return deps.skills.listAllowed();
}
