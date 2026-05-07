import type { AppDb } from "@/db/client";
import { events } from "@/db/schema";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { NewEvent } from "@/domain/event";
import { eq } from "drizzle-orm";

export class DrizzleEventRepository implements IEventRepository {
	constructor(private readonly db: AppDb) {}

	async insertMany(newEvents: NewEvent[]): Promise<void> {
		if (newEvents.length === 0) return;
		await this.db
			.insert(events)
			.values(
				newEvents.map((e) => ({
					userEmail: e.userEmail,
					sessionId: e.sessionId,
					eventName: e.eventName,
					timestamp: e.timestamp,
					attributes: e.attributes,
					source: e.source,
					sourceIntegrationId: e.sourceIntegrationId ?? null,
				})),
			)
			.onConflictDoNothing();
	}

	async deleteByIntegrationId(integrationId: string): Promise<void> {
		await this.db.delete(events).where(eq(events.sourceIntegrationId, integrationId));
	}
}
