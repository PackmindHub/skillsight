import type { AppDb } from "@/db/client";
import { events } from "@/db/schema";
import { EVENT_NAMES } from "@/domain/event";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { NewEvent } from "@/domain/event";
import { and, eq, or, sql } from "drizzle-orm";

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

	async deleteBySkillKeys(
		entries: Array<{ skillName: string; pluginName: string }>,
	): Promise<number> {
		if (entries.length === 0) return 0;
		const conditions = entries.map((e) =>
			and(
				sql`(${events.attributes}->>'skill.name') = ${e.skillName}`,
				sql`COALESCE(${events.attributes}->>'plugin.name', '') = ${e.pluginName}`,
			),
		);
		const deleted = await this.db
			.delete(events)
			.where(and(eq(events.eventName, EVENT_NAMES.SKILL_ACTIVATED), or(...conditions)))
			.returning({ id: events.id });
		return deleted.length;
	}
}
