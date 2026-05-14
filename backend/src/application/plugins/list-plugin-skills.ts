import type {
	PluginSkillActivation,
	PluginUserActivation,
	PluginVersionRow,
	PluginWeeklyLoaders,
} from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import { maxSemver } from "@/lib/semver";

const TOP_USERS_LIMIT = 10;

export interface PluginDrawerData {
	skills: PluginSkillActivation[];
	topUsers: PluginUserActivation[];
	versions: PluginVersionRow[];
	latestVersion: string | null;
	weeklyLoaders: PluginWeeklyLoaders;
}

export async function listPluginSkills(
	deps: { plugins: IPluginRepository; pluginVersions: IPluginVersionRepository },
	pluginName: string,
	marketplaceName: string | null,
): Promise<PluginDrawerData> {
	const [skills, topUsers, versions, weeklyLoaders] = await Promise.all([
		deps.plugins.listSkillsWithActivations(pluginName),
		deps.plugins.listTopUsers(pluginName, TOP_USERS_LIMIT),
		deps.pluginVersions.listForPlugin(pluginName, marketplaceName),
		deps.plugins.getWeeklyLoadersByVersion(pluginName, marketplaceName),
	]);
	return {
		skills,
		topUsers,
		versions,
		latestVersion: maxSemver(versions.map((v) => v.version)),
		weeklyLoaders,
	};
}
