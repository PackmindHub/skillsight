import type { PluginWeeklyLoaders } from "@/domain/plugin";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";

export async function getPluginWeeklyLoaders(
	deps: { plugins: IPluginRepository },
	input: { pluginName: string; marketplaceName: string | null },
): Promise<PluginWeeklyLoaders> {
	return deps.plugins.getWeeklyLoadersByVersion(input.pluginName, input.marketplaceName);
}
