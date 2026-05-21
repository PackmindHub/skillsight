import type { ExternalSkillMappingCache } from "@/application/external-skill-mappings/mapping-cache";
import { resolveSkillContext } from "@/application/external-skill-mappings/resolve-skill-context";
import { EVENT_NAMES } from "@/domain/event";
import {
	computePluginStatus,
	normalizeMarketplaceName,
	type PluginVersionSeen,
} from "@/domain/plugin";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { IPluginVersionRepository } from "@/domain/ports/plugin-version-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { eventBus } from "@/lib/event-bus";
import { parseOtlpBody } from "@/parsers/otlp-parser";

export async function ingestEvents(
	deps: {
		events: IEventRepository;
		marketplaces: IMarketplaceRepository;
		plugins: IPluginRepository;
		pluginSkills: IPluginSkillRepository;
		pluginVersions: IPluginVersionRepository;
		skills: ISkillRepository;
		mappingCache: ExternalSkillMappingCache;
	},
	rawBody: unknown,
): Promise<{ rejected: boolean; error?: string }> {
	let parsed: ReturnType<typeof parseOtlpBody>;
	try {
		parsed = parseOtlpBody(rawBody);
	} catch (err) {
		return { rejected: true, error: String(err) };
	}

	if (parsed.length === 0) return { rejected: false };

	const events = parsed.filter(
		(e) =>
			e.eventName === EVENT_NAMES.SKILL_ACTIVATED ||
			e.eventName === EVENT_NAMES.PLUGIN_INSTALLED ||
			e.eventName === EVENT_NAMES.PLUGIN_LOADED,
	);
	if (events.length === 0) return { rejected: false };

	await deps.events.insertMany(
		events.map((e) => ({ ...e, source: "direct" as const })),
	);

	const resolveCtx = (skillName: string, attrs: Record<string, unknown>) =>
		resolveSkillContext(
			deps.mappingCache,
			skillName,
			attrs["plugin.name"],
			attrs["marketplace.name"],
		);

	for (const e of events) {
		if (e.eventName !== EVENT_NAMES.SKILL_ACTIVATED) continue;
		const skillName = e.attributes["skill.name"];
		if (typeof skillName !== "string") continue;
		const ctx = resolveCtx(skillName, e.attributes);
		eventBus.emitSkillActivated({
			id: `${e.timestamp.getTime()}_${skillName}_${e.sessionId ?? ""}_${e.userEmail ?? ""}`,
			timestamp: e.timestamp.toISOString(),
			userEmail: e.userEmail,
			sessionId: e.sessionId,
			skillName,
			pluginName: ctx.pluginName,
			marketplaceName: ctx.marketplaceName,
			trigger:
				typeof e.attributes.invocation_trigger === "string"
					? (e.attributes.invocation_trigger as string)
					: null,
		});
	}

	const mpNames = [
		...new Set(
			events
				.filter((e) => e.eventName === EVENT_NAMES.SKILL_ACTIVATED)
				.flatMap((e) => {
					const skillName = e.attributes["skill.name"];
					if (typeof skillName !== "string") return [];
					const ctx = resolveCtx(skillName, e.attributes);
					return ctx.marketplaceName ? [ctx.marketplaceName] : [];
				}),
		),
	];
	if (mpNames.length > 0) {
		await deps.marketplaces.upsertSeen(mpNames);
	}

	const skillEntries = events
		.filter(
			(e) =>
				e.eventName === EVENT_NAMES.SKILL_ACTIVATED &&
				typeof e.attributes["skill.name"] === "string",
		)
		.map((e) => {
			const skillName = e.attributes["skill.name"] as string;
			const ctx = resolveCtx(skillName, e.attributes);
			return { skillName, pluginName: ctx.pluginName };
		});
	if (skillEntries.length > 0) {
		await deps.skills.upsertMany(skillEntries);
	}

	// skill_activated events that, after resolution, have an effective plugin name —
	// either because the event carried plugin.name, or because the mapping cache
	// supplied one (e.g. Packmind retro-link).
	const skillActivationsWithPlugin = events.flatMap((e) => {
		if (e.eventName !== EVENT_NAMES.SKILL_ACTIVATED) return [];
		const skillName = e.attributes["skill.name"];
		if (typeof skillName !== "string") return [];
		const ctx = resolveCtx(skillName, e.attributes);
		if (!ctx.pluginName) return [];
		return [{ skillName, pluginName: ctx.pluginName, marketplaceName: ctx.marketplaceName }];
	});

	const pluginEvents = events.filter(
		(e) =>
			e.eventName === EVENT_NAMES.PLUGIN_INSTALLED &&
			typeof e.attributes["plugin.name"] === "string",
	);

	// plugin_loaded fires once per enabled plugin at session start. We keep every
	// row in `events` (the Dashboard counts redacted "third-party" rows for fleet
	// inventory), but only upsert real plugin.name values into the catalog so a
	// plugin seen only via loads still appears on /plugins. Use upsertIfAbsent so
	// we never clobber an admin status override.
	const pluginLoadedEvents = events.filter(
		(e) =>
			e.eventName === EVENT_NAMES.PLUGIN_LOADED &&
			typeof e.attributes["plugin.name"] === "string" &&
			e.attributes["plugin.name"] !== "third-party",
	);

	const needsStatusMap =
		skillActivationsWithPlugin.length > 0 ||
		pluginEvents.length > 0 ||
		pluginLoadedEvents.length > 0;
	const statusMap = needsStatusMap
		? Object.fromEntries(
				(await deps.marketplaces.listStatuses()).map((m) => [m.name, m.status]),
			)
		: {};

	if (skillActivationsWithPlugin.length > 0) {
		const seenPlugins = new Set<string>();
		const pluginSkillPairs: Array<{ pluginName: string; skillName: string }> = [];

		for (const entry of skillActivationsWithPlugin) {
			pluginSkillPairs.push({ pluginName: entry.pluginName, skillName: entry.skillName });

			if (seenPlugins.has(entry.pluginName)) continue;
			seenPlugins.add(entry.pluginName);

			const status = computePluginStatus(
				entry.marketplaceName,
				entry.marketplaceName ? statusMap[entry.marketplaceName] : null,
			);

			await deps.plugins.upsertIfAbsent({
				pluginName: entry.pluginName,
				marketplaceName: entry.marketplaceName,
				pluginVersion: null,
				installTrigger: null,
				marketplaceIsOfficial: null,
				status,
			});
		}
		await deps.pluginSkills.upsertMany(pluginSkillPairs);
	}

	if (pluginEvents.length > 0) {
		const seen = new Set<string>();
		for (const event of pluginEvents) {
			const pluginName = event.attributes["plugin.name"] as string;
			if (seen.has(pluginName)) continue;
			seen.add(pluginName);

			const marketplaceName = normalizeMarketplaceName(
				typeof event.attributes["marketplace.name"] === "string"
					? (event.attributes["marketplace.name"] as string)
					: null,
			);
			const pluginVersion =
				typeof event.attributes["plugin.version"] === "string"
					? (event.attributes["plugin.version"] as string)
					: null;
			const installTrigger =
				typeof event.attributes["install.trigger"] === "string"
					? (event.attributes["install.trigger"] as string)
					: null;
			const isOfficialRaw = event.attributes["marketplace.is_official"];
			const marketplaceIsOfficial =
				isOfficialRaw !== undefined ? isOfficialRaw === "true" || isOfficialRaw === true : null;

			const status = computePluginStatus(
				marketplaceName,
				marketplaceName ? statusMap[marketplaceName] : null,
			);

			await deps.plugins.upsert({
				pluginName,
				marketplaceName,
				pluginVersion,
				installTrigger,
				marketplaceIsOfficial,
				status,
			});
		}
	}

	// Collect version sightings from both plugin_installed and plugin_loaded.
	// Identity for version rows is the triple (plugin.name, marketplace.name,
	// version); the repository handles dedupe + null->'' marketplace conversion.
	// Skips redacted "third-party" rows: their plugin.name doesn't identify a
	// real plugin so version attribution would be meaningless.
	const versionSightings: PluginVersionSeen[] = [];
	for (const e of [...pluginEvents, ...pluginLoadedEvents]) {
		const pluginName = e.attributes["plugin.name"];
		const version = e.attributes["plugin.version"];
		if (typeof pluginName !== "string" || pluginName === "third-party") continue;
		if (typeof version !== "string" || version.length === 0) continue;
		versionSightings.push({
			pluginName,
			marketplaceName: normalizeMarketplaceName(
				typeof e.attributes["marketplace.name"] === "string"
					? (e.attributes["marketplace.name"] as string)
					: null,
			),
			version,
		});
	}
	if (versionSightings.length > 0) {
		await deps.pluginVersions.upsertSeen(versionSightings);
	}

	if (pluginLoadedEvents.length > 0) {
		// Plugin identity here is (plugin.name, marketplace.name). The current
		// `plugins` table keys only on pluginName, so collisions silently become
		// no-ops via upsertIfAbsent — accepted limitation until the composite-key
		// migration lands.
		const seen = new Set<string>();
		for (const event of pluginLoadedEvents) {
			const pluginName = event.attributes["plugin.name"] as string;
			const marketplaceName = normalizeMarketplaceName(
				typeof event.attributes["marketplace.name"] === "string"
					? (event.attributes["marketplace.name"] as string)
					: null,
			);
			const key = `${pluginName} ${marketplaceName ?? ""}`;
			if (seen.has(key)) continue;
			seen.add(key);

			const pluginVersion =
				typeof event.attributes["plugin.version"] === "string"
					? (event.attributes["plugin.version"] as string)
					: null;
			const status = computePluginStatus(
				marketplaceName,
				marketplaceName ? statusMap[marketplaceName] : null,
			);

			await deps.plugins.upsertIfAbsent({
				pluginName,
				marketplaceName,
				pluginVersion,
				installTrigger: null,
				marketplaceIsOfficial: null,
				status,
			});
		}
	}

	return { rejected: false };
}
