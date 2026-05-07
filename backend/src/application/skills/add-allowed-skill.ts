import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AllowedSkill } from "@/domain/skill";

export async function addAllowedSkill(
	deps: { skills: ISkillRepository; audit: IAuditRepository },
	input: { skillName: string; source?: string; actorEmail: string },
): Promise<AllowedSkill | { skillName: string }> {
	const result = await deps.skills.addAllowed({
		skillName: input.skillName,
		source: input.source ?? "manual",
		addedBy: input.actorEmail,
	});

	await deps.audit.log({
		actorEmail: input.actorEmail,
		action: "allowlist_added",
		target: input.skillName,
	});

	return result ?? { skillName: input.skillName };
}
