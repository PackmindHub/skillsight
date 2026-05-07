import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AllowedSkill } from "@/domain/skill";

export async function removeAllowedSkill(
	deps: { skills: ISkillRepository; audit: IAuditRepository },
	input: { skillName: string; actorEmail: string },
): Promise<AllowedSkill | { error: "not_found" }> {
	const deleted = await deps.skills.removeAllowed(input.skillName);
	if (!deleted) return { error: "not_found" };

	await deps.audit.log({
		actorEmail: input.actorEmail,
		action: "allowlist_removed",
		target: input.skillName,
	});

	return deleted;
}
