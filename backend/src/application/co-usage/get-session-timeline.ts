import type { IEventRepository } from "@/domain/ports/event-repository";

export interface SessionTimelineEventDto {
	skillName: string;
	pluginName: string | null;
	timestamp: string;
}

export interface SessionTimelineResponse {
	sessionId: string;
	events: SessionTimelineEventDto[];
}

export async function getSessionTimeline(
	deps: { events: IEventRepository },
	input: { sessionId: string },
): Promise<SessionTimelineResponse> {
	const rows = await deps.events.listSessionTimeline(input.sessionId);
	return {
		sessionId: input.sessionId,
		events: rows.map((r) => ({
			skillName: r.skillName,
			pluginName: r.pluginName,
			timestamp: r.timestamp.toISOString(),
		})),
	};
}
