export interface IPluginSkillRepository {
	upsertMany(skills: Array<{ pluginName: string; skillName: string }>): Promise<void>;
	deleteByPlugins(pluginNames: string[]): Promise<void>;
}
