import type { PluginSkill } from "@/domain/plugin-skill";

export interface IPluginSkillRepository {
	upsertMany(skills: Array<{ pluginName: string; skillName: string }>): Promise<void>;
	listByPlugin(pluginName: string): Promise<PluginSkill[]>;
}
