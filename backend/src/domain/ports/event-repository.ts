import type { NewEvent } from "@/domain/event";

export interface RecentSkillActivatedEvent {
	id: string;
	timestamp: Date;
	userEmail: string | null;
	sessionId: string | null;
	skillName: string;
	pluginName: string | null;
	marketplaceName: string | null;
	trigger: string | null;
}

export interface IEventRepository {
	insertMany(events: NewEvent[]): Promise<void>;
	deleteByIntegrationId(integrationId: string): Promise<void>;
	deleteBySkillKeys(entries: Array<{ skillName: string; pluginName: string }>): Promise<number>;
	listRecentSkillActivations(limit: number): Promise<RecentSkillActivatedEvent[]>;
}
