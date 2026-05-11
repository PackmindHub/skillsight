import type { PluginSkillActivation, PluginUserActivation } from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";

const TOP_USERS_LIMIT = 10;

export interface PluginDrawerData {
	skills: PluginSkillActivation[];
	topUsers: PluginUserActivation[];
}

export async function listPluginSkills(
	deps: { plugins: IPluginRepository },
	pluginName: string,
): Promise<PluginDrawerData> {
	const [skills, topUsers] = await Promise.all([
		deps.plugins.listSkillsWithActivations(pluginName),
		deps.plugins.listTopUsers(pluginName, TOP_USERS_LIMIT),
	]);
	return { skills, topUsers };
}
