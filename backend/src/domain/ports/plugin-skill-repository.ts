export interface IPluginSkillRepository {
	upsertMany(skills: Array<{ pluginName: string; skillName: string }>): Promise<void>;
}
