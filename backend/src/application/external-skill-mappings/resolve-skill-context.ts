import { normalizeMarketplaceName } from "@/domain/plugin";
import type { ExternalSkillMappingCache } from "./mapping-cache";

export interface ResolvedSkillContext {
	pluginName: string | null;
	marketplaceName: string | null;
}

// Resolves the (pluginName, marketplaceName) that a skill_activated event
// should be attributed to. An explicit `plugin.name` attribute always wins;
// when it's absent, the in-memory mapping cache is consulted so that skills
// retro-associated via Packmind sync (which doesn't emit plugin.name on its
// telemetry) still land on the linked row instead of an orphan.
export function resolveSkillContext(
	cache: ExternalSkillMappingCache,
	skillName: string,
	rawPluginName: unknown,
	rawMarketplaceName: unknown,
): ResolvedSkillContext {
	const explicitPlugin =
		typeof rawPluginName === "string" && rawPluginName.length > 0 ? rawPluginName : null;
	const explicitMp = normalizeMarketplaceName(
		typeof rawMarketplaceName === "string" ? rawMarketplaceName : null,
	);
	if (explicitPlugin) {
		return { pluginName: explicitPlugin, marketplaceName: explicitMp };
	}
	const hit = cache.lookup(skillName);
	if (hit) {
		return { pluginName: hit.pluginName, marketplaceName: hit.marketplaceName };
	}
	return { pluginName: null, marketplaceName: explicitMp };
}
