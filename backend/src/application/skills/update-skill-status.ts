import { recordAudit } from "@/application/audit/record-audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { Skill, SkillStatus } from "@/domain/skill";

export async function updateSkillStatus(
	deps: { skills: ISkillRepository; audit: IAuditRepository },
	input: {
		skillName: string;
		pluginName: string;
		status: SkillStatus;
		actorEmail: string | null;
	},
): Promise<Skill | { error: "not_found" | "not_editable" }> {
	const existing = await deps.skills.findByKey({
		skillName: input.skillName,
		pluginName: input.pluginName,
	});
	if (!existing) return { error: "not_found" };
	if (existing.pluginName !== "") return { error: "not_editable" };

	if (existing.status === input.status) return existing;

	const updated = await deps.skills.updateStatus(
		{ skillName: input.skillName, pluginName: input.pluginName },
		input.status,
	);
	if (!updated) return { error: "not_found" };

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "skill_status_changed",
		target: input.skillName,
		metadata: {
			from: existing.status,
			to: input.status,
			pluginName: input.pluginName,
			scope: "direct",
		},
	});

	return updated;
}
