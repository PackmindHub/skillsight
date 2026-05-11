import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { ILokiGateway, LokiStreamResult } from "@/domain/ports/loki-gateway";
import { decrypt } from "@/infrastructure/crypto/encrypt";
import { parseLokiStreams } from "@/parsers/loki-stream-parser";

export interface PreviewEvent {
	eventName: string;
	userEmail: string | null;
	timestamp: string;
	attributes: Record<string, unknown>;
}

export async function previewIntegration(
	deps: { integrations: IIntegrationRepository; loki: ILokiGateway },
	input: {
		url: string;
		authType: "none" | "basic";
		authUsername?: string | null;
		authPassword?: string | null;
		lokiQuery: string;
		integrationId?: string | null;
	},
): Promise<PreviewEvent[]> {
	let password = input.authPassword ?? null;
	if (!password && input.authType === "basic" && input.integrationId) {
		const stored = await deps.integrations.findById(input.integrationId);
		if (stored?.authPasswordEncrypted) password = decrypt(stored.authPasswordEncrypted);
	}

	const to = new Date();
	const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

	const streams = await deps.loki.fetchLogs({
		url: input.url,
		authType: input.authType,
		username: input.authUsername ?? null,
		password,
		query: input.lokiQuery,
		from,
		to,
	});

	return parsePreviewStreams(streams).slice(0, 3);
}

function parsePreviewStreams(streams: LokiStreamResult[]): PreviewEvent[] {
	return parseLokiStreams(streams)
		.filter(
			(e) =>
				e.eventName === "claude_code.skill_activated" ||
				e.eventName === "claude_code.plugin_installed",
		)
		.map((e) => ({
			eventName: e.eventName,
			userEmail: e.userEmail,
			timestamp: e.timestamp.toISOString(),
			attributes: e.attributes,
		}));
}
