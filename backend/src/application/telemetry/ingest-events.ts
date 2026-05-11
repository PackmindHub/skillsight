import { EVENT_NAMES } from "@/domain/event";
import { computePluginStatus, normalizeMarketplaceName } from "@/domain/plugin";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import type { IPluginSkillRepository } from "@/domain/ports/plugin-skill-repository";
import type { ISkillRepository } from "@/domain/ports/skill-repository";
import { parseOtlpBody } from "@/parsers/otlp-parser";

export async function ingestEvents(
	deps: {
		events: IEventRepository;
		marketplaces: IMarketplaceRepository;
		plugins: IPluginRepository;
		pluginSkills: IPluginSkillRepository;
		skills: ISkillRepository;
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
			e.eventName === EVENT_NAMES.PLUGIN_INSTALLED,
	);
	if (events.length === 0) return { rejected: false };

	await deps.events.insertMany(
		events.map((e) => ({ ...e, source: "direct" as const })),
	);

	const mpNames = [
		...new Set(
			events
				.filter((e) => e.eventName === EVENT_NAMES.SKILL_ACTIVATED)
				.map((e) =>
					normalizeMarketplaceName(
						typeof e.attributes["marketplace.name"] === "string"
							? (e.attributes["marketplace.name"] as string)
							: null,
					),
				)
				.filter((name): name is string => name !== null),
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
		.map((e) => ({
			skillName: e.attributes["skill.name"] as string,
			pluginName:
				typeof e.attributes["plugin.name"] === "string"
					? (e.attributes["plugin.name"] as string)
					: null,
		}));
	if (skillEntries.length > 0) {
		await deps.skills.upsertMany(skillEntries);
	}

	const skillActivationsWithPlugin = events.filter(
		(e) =>
			e.eventName === EVENT_NAMES.SKILL_ACTIVATED &&
			typeof e.attributes["skill.name"] === "string" &&
			typeof e.attributes["plugin.name"] === "string",
	);

	const pluginEvents = events.filter(
		(e) =>
			e.eventName === EVENT_NAMES.PLUGIN_INSTALLED &&
			typeof e.attributes["plugin.name"] === "string",
	);

	const needsStatusMap = skillActivationsWithPlugin.length > 0 || pluginEvents.length > 0;
	const statusMap = needsStatusMap
		? Object.fromEntries(
				(await deps.marketplaces.listStatuses()).map((m) => [m.name, m.status]),
			)
		: {};

	if (skillActivationsWithPlugin.length > 0) {
		const seenPlugins = new Set<string>();
		const pluginSkillPairs: Array<{ pluginName: string; skillName: string }> = [];

		for (const event of skillActivationsWithPlugin) {
			const pluginName = event.attributes["plugin.name"] as string;
			const skillName = event.attributes["skill.name"] as string;
			pluginSkillPairs.push({ pluginName, skillName });

			if (seenPlugins.has(pluginName)) continue;
			seenPlugins.add(pluginName);

			const marketplaceName = normalizeMarketplaceName(
				typeof event.attributes["marketplace.name"] === "string"
					? (event.attributes["marketplace.name"] as string)
					: null,
			);
			const status = computePluginStatus(
				marketplaceName,
				marketplaceName ? statusMap[marketplaceName] : null,
			);

			await deps.plugins.upsertIfAbsent({
				pluginName,
				marketplaceName,
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

	return { rejected: false };
}
