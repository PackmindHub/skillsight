import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IMarketplaceRepository } from "@/domain/ports/marketplace-repository";
import { parseOtlpBody } from "@/parsers/otlp-parser";

export async function ingestEvents(
	deps: { events: IEventRepository; marketplaces: IMarketplaceRepository },
	rawBody: unknown,
): Promise<{ rejected: boolean; error?: string }> {
	let parsed: ReturnType<typeof parseOtlpBody>;
	try {
		parsed = parseOtlpBody(rawBody);
	} catch (err) {
		return { rejected: true, error: String(err) };
	}

	if (parsed.length === 0) return { rejected: false };

	await deps.events.insertMany(
		parsed.map((e) => ({ ...e, source: "direct" as const })),
	);

	const mpNames = [
		...new Set(
			parsed
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

	return { rejected: false };
}
