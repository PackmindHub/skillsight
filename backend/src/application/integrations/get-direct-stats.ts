import type { IEventRepository } from "@/domain/ports/event-repository";

export interface DirectStatsDto {
	eventCount: number;
	lastEventAt: string | null;
}

export async function getDirectStats(
	deps: { events: IEventRepository },
): Promise<DirectStatsDto> {
	const stats = await deps.events.getDirectStats();
	return {
		eventCount: stats.eventCount,
		lastEventAt: stats.lastEventAt ? stats.lastEventAt.toISOString() : null,
	};
}
