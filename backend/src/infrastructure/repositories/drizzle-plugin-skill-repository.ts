import { inArray } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { pluginSkills } from "@/db/schema";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";

export class DrizzlePluginSkillRepository implements IPluginSkillRepository {
	constructor(private readonly db: AppDb) {}

	async upsertMany(skills: Array<{ pluginName: string; skillName: string }>): Promise<void> {
		if (skills.length === 0) return;
		// Postgres rejects ON CONFLICT DO UPDATE when the same conflict target
		// appears twice in one VALUES list. Sync batches routinely contain many
		// events for the same (plugin, skill) pair, so dedupe before insert.
		const seen = new Set<string>();
		const unique: Array<{ pluginName: string; skillName: string }> = [];
		for (const s of skills) {
			const key = `${s.pluginName}\x00${s.skillName}`;
			if (seen.has(key)) continue;
			seen.add(key);
			unique.push(s);
		}
		const now = new Date();
		await this.db
			.insert(pluginSkills)
			.values(
				unique.map((s) => ({
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

	async deleteByPlugins(pluginNames: string[]): Promise<void> {
		if (pluginNames.length === 0) return;
		await this.db.delete(pluginSkills).where(inArray(pluginSkills.pluginName, pluginNames));
	}
}
