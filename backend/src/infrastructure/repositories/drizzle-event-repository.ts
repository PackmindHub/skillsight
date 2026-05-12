import type { AppDb } from "@/db/client";
import { events } from "@/db/schema";
import { EVENT_NAMES } from "@/domain/event";
import type {
	CohortsWindow,
	DirectEventStats,
	IEventRepository,
	RecentSkillActivatedEvent,
	UserSkillActivation,
} from "@/domain/ports/event-repository";
import type { NewEvent } from "@/domain/event";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { normalizeMarketplaceName } from "@/domain/plugin";

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

	async deleteDirectEvents(): Promise<void> {
		await this.db.delete(events).where(eq(events.source, "direct"));
	}

	async getDirectStats(): Promise<DirectEventStats> {
		const [row] = await this.db
			.select({
				cnt: sql<number>`COUNT(*)::int`,
				lastEventAt: sql<Date | null>`MAX(${events.timestamp})`,
			})
			.from(events)
			.where(eq(events.source, "direct"));
		const lastEventAt = row?.lastEventAt ?? null;
		return {
			eventCount: Number(row?.cnt ?? 0),
			lastEventAt:
				lastEventAt === null
					? null
					: lastEventAt instanceof Date
						? lastEventAt
						: new Date(lastEventAt as unknown as string),
		};
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

	async listRecentSkillActivations(limit: number): Promise<RecentSkillActivatedEvent[]> {
		const rows = await this.db
			.select({
				id: events.id,
				timestamp: events.timestamp,
				userEmail: events.userEmail,
				sessionId: events.sessionId,
				attributes: events.attributes,
			})
			.from(events)
			.where(
				and(
					eq(events.eventName, EVENT_NAMES.SKILL_ACTIVATED),
					sql`(${events.attributes}->>'skill.name') IS NOT NULL`,
				),
			)
			.orderBy(desc(events.timestamp))
			.limit(limit);

		return rows.map((row) => {
			const attrs = (row.attributes ?? {}) as Record<string, unknown>;
			return {
				id: String(row.id),
				timestamp: row.timestamp,
				userEmail: row.userEmail ?? null,
				sessionId: row.sessionId ?? null,
				skillName: String(attrs["skill.name"]),
				pluginName:
					typeof attrs["plugin.name"] === "string" ? (attrs["plugin.name"] as string) : null,
				marketplaceName: normalizeMarketplaceName(
					typeof attrs["marketplace.name"] === "string"
						? (attrs["marketplace.name"] as string)
						: null,
				),
				trigger:
					typeof attrs.invocation_trigger === "string"
						? (attrs.invocation_trigger as string)
						: null,
			};
		});
	}

	async listUserSkillActivations(window: CohortsWindow): Promise<UserSkillActivation[]> {
		const skillExpr = sql<string>`(${events.attributes}->>'skill.name')`;
		const conditions = [
			eq(events.eventName, EVENT_NAMES.SKILL_ACTIVATED),
			sql`${events.userEmail} IS NOT NULL`,
			sql`${skillExpr} IS NOT NULL`,
		];
		if (window !== "all") {
			conditions.push(sql`${events.timestamp} >= NOW() - (${window} || ' days')::interval`);
		}

		const rows = await this.db
			.select({
				userEmail: events.userEmail,
				skillName: skillExpr,
				activations: sql<number>`COUNT(*)::int`,
				lastActivatedAt: sql<Date>`MAX(${events.timestamp})`,
			})
			.from(events)
			.where(and(...conditions))
			.groupBy(events.userEmail, skillExpr);

		return rows
			.filter((r): r is typeof r & { userEmail: string } => r.userEmail != null)
			.map((r) => ({
				userEmail: r.userEmail,
				skillName: r.skillName,
				activations: Number(r.activations),
				lastActivatedAt: r.lastActivatedAt instanceof Date
					? r.lastActivatedAt
					: new Date(r.lastActivatedAt as unknown as string),
			}));
	}
}
