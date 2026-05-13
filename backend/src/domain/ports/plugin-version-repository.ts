import type { PluginVersionRow, PluginVersionSeen } from "@/domain/plugin";

export interface IPluginVersionRepository {
	// Upsert with `'' sentinel`-normalized marketplaceName; caller passes nulls and
	// the repo handles the wire->storage conversion. firstSeenAt is preserved on
	// conflict; lastSeenAt bumps to NOW().
	upsertSeen(entries: PluginVersionSeen[]): Promise<void>;

	// Returns versions for a specific (plugin_name, marketplace_name) pair. Pass
	// marketplaceName=null to look up the no-marketplace bucket. Joins to
	// plugin_loaded events on the fly to populate loadCount / uniqueLoaderCount.
	// Ordered by lastSeenAt DESC.
	listForPlugin(
		pluginName: string,
		marketplaceName: string | null,
	): Promise<PluginVersionRow[]>;

	// Returns just the version strings for a plugin pair (cheap, no join). Used by
	// listWithStats to compute versionCount and semver-max latestVersion in TS.
	listVersionStrings(pluginName: string, marketplaceName: string | null): Promise<string[]>;
}
