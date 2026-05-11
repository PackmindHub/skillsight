import type { NewEvent } from "@/domain/event";

export interface IEventRepository {
	insertMany(events: NewEvent[]): Promise<void>;
	deleteByIntegrationId(integrationId: string): Promise<void>;
	deleteBySkillKeys(entries: Array<{ skillName: string; pluginName: string }>): Promise<number>;
}
