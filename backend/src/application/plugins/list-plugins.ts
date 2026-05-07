import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { PluginWithStats } from "@/domain/plugin";

export async function listPlugins(
	deps: { plugins: IPluginRepository },
): Promise<PluginWithStats[]> {
	return deps.plugins.listWithStats();
}
