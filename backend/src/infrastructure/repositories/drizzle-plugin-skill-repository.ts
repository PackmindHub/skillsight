import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { pluginSkills } from "@/db/schema";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { PluginSkill } from "@/domain/plugin-skill";

export class DrizzlePluginSkillRepository implements IPluginSkillRepository {
	constructor(private readonly db: AppDb) {}

	async upsertMany(skills: Array<{ pluginName: string; skillName: string }>): Promise<void> {
		if (skills.length === 0) return;
		const now = new Date();
		await this.db
			.insert(pluginSkills)
			.values(
				skills.map((s) => ({
					pluginName: s.pluginName,
					skillName: s.skillName,
					firstSeenAt: now,
					lastSeenAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: [pluginSkills.pluginName, pluginSkills.skillName],
				set: { lastSeenAt: now },
			});
	}

	async listByPlugin(pluginName: string): Promise<PluginSkill[]> {
		const rows = await this.db
			.select()
			.from(pluginSkills)
			.where(eq(pluginSkills.pluginName, pluginName));
		return rows.map((r) => ({
			pluginName: r.pluginName,
			skillName: r.skillName,
			firstSeenAt: r.firstSeenAt,
			lastSeenAt: r.lastSeenAt,
		}));
	}
}
