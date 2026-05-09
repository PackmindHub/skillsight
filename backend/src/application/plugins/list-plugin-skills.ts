import type { PluginSkillActivation } from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";

export async function listPluginSkills(
	deps: { plugins: IPluginRepository },
	pluginName: string,
): Promise<PluginSkillActivation[]> {
	return deps.plugins.listSkillsWithActivations(pluginName);
}
