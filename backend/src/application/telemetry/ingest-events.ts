import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";
import { parseOtlpBody } from "@/parsers/otlp-parser";
import { computePluginStatus } from "@/domain/plugin";

export async function ingestEvents(
	deps: { events: IEventRepository; marketplaces: IMarketplaceRepository; plugins: IPluginRepository },
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
			e.eventName === "claude_code.skill_activated" ||
			e.eventName === "claude_code.plugin_installed",
	);
	if (events.length === 0) return { rejected: false };

	await deps.events.insertMany(
		events.map((e) => ({ ...e, source: "direct" as const })),
	);

	const mpNames = [
		...new Set(
			events
				.filter(
					(e) =>
						e.eventName === "claude_code.skill_activated" &&
						typeof e.attributes["marketplace.name"] === "string",
				)
				.map((e) => e.attributes["marketplace.name"] as string),
		),
	];
	if (mpNames.length > 0) {
		await deps.marketplaces.upsertSeen(mpNames);
	}

	const pluginEvents = events.filter(
		(e) =>
			e.eventName === "claude_code.plugin_installed" &&
			typeof e.attributes["plugin.name"] === "string",
	);

	if (pluginEvents.length > 0) {
		const marketplaceStatuses = await deps.marketplaces.listStatuses();
		const statusMap = Object.fromEntries(marketplaceStatuses.map((m) => [m.name, m.status]));

		const seen = new Set<string>();
		for (const event of pluginEvents) {
			const pluginName = event.attributes["plugin.name"] as string;
			if (seen.has(pluginName)) continue;
			seen.add(pluginName);

			const marketplaceName =
				typeof event.attributes["marketplace.name"] === "string"
					? (event.attributes["marketplace.name"] as string)
					: null;
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
