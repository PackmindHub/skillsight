import { recordAudit } from "@/application/audit/record-audit";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import type { SkillKey, SkillStatus } from "@/domain/skill";

export const UPDATE_SKILLS_STATUS_MAX_BATCH = 500;

export interface UpdateSkillsStatusInput {
	entries: SkillKey[];
	status: SkillStatus;
	actorEmail: string | null;
}

export type UpdateSkillsStatusResult =
	| { updated: number; skippedInherited: number; notFound: number }
	| { error: "empty" | "too_many" };

export async function updateSkillsStatus(
	deps: { skills: ISkillRepository; audit: IAuditRepository },
	input: UpdateSkillsStatusInput,
): Promise<UpdateSkillsStatusResult> {
	const seen = new Set<string>();
	const normalized: SkillKey[] = [];
	for (const e of input.entries) {
		const skillName = e.skillName?.trim();
		if (!skillName) continue;
		const pluginName = e.pluginName ?? "";
		const marketplaceName = e.marketplaceName ?? "";
		const skillSource = e.skillSource ?? "";
		const key = [skillName, pluginName, marketplaceName, skillSource].join("\u0000");
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push({ skillName, pluginName, marketplaceName, skillSource });
	}

	if (normalized.length === 0) return { error: "empty" };
	if (normalized.length > UPDATE_SKILLS_STATUS_MAX_BATCH) return { error: "too_many" };

	let updated = 0;
	let skippedInherited = 0;
	let notFound = 0;

	for (const entry of normalized) {
		const existing = await deps.skills.findByKey(entry);
		if (!existing) {
			notFound++;
			continue;
		}
		if (existing.pluginName !== "") {
			skippedInherited++;
			continue;
		}
		if (existing.status === input.status) continue;
		const result = await deps.skills.updateStatus(entry, input.status);
		if (result) updated++;
		else notFound++;
	}

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "skills_status_changed",
		target: null,
		metadata: {
			to: input.status,
			requested: normalized.length,
			updated,
			skippedInherited,
			notFound,
			scope: "bulk",
			skills: normalized.slice(0, 50),
		},
	});

	return { updated, skippedInherited, notFound };
}
