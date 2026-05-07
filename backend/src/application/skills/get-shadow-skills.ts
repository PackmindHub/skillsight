import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { ShadowSkill } from "@/domain/skill";

export async function getShadowSkills(
	deps: { skills: ISkillRepository },
): Promise<ShadowSkill[]> {
	return deps.skills.getShadowSkills();
}
