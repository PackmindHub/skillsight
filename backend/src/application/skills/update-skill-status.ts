import { recordAudit } from "@/application/audit/record-audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { Skill, SkillStatus } from "@/domain/skill";

export async function updateSkillStatus(
	deps: { skills: ISkillRepository; audit: IAuditRepository },
	input: {
		skillName: string;
		pluginName: string;
		marketplaceName: string;
		skillSource: string;
		status: SkillStatus;
		actorEmail: string | null;
	},
): Promise<Skill | { error: "not_found" | "not_editable" }> {
	const key = {
		skillName: input.skillName,
		pluginName: input.pluginName,
		marketplaceName: input.marketplaceName,
		skillSource: input.skillSource,
	};
	const existing = await deps.skills.findByKey(key);
	if (!existing) return { error: "not_found" };
	if (existing.pluginName !== "") return { error: "not_editable" };

	if (existing.status === input.status) return existing;

	const updated = await deps.skills.updateStatus(key, input.status);
	if (!updated) return { error: "not_found" };

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "skill_status_changed",
		target: input.skillName,
		metadata: {
			from: existing.status,
			to: input.status,
			pluginName: input.pluginName,
			marketplaceName: input.marketplaceName,
			skillSource: input.skillSource,
			scope: "direct",
		},
	});

	return updated;
}
