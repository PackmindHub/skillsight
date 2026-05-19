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

export interface UserSkillActivation {
	userEmail: string;
	skillName: string;
	activations: number;
	lastActivatedAt: Date;
}

export interface SessionSkillActivation {
	sessionId: string;
	userEmail: string | null;
	skillName: string;
	activations: number;
	lastActivatedAt: Date;
}

export type CohortsWindow = "all" | number;

export interface DirectEventStats {
	eventCount: number;
	lastEventAt: Date | null;
}

export interface IEventRepository {
	insertMany(events: NewEvent[]): Promise<void>;
	deleteByIntegrationId(integrationId: string): Promise<void>;
	deleteDirectEvents(): Promise<void>;
	deleteBySkillKeys(entries: Array<{ skillName: string; pluginName: string }>): Promise<number>;
	listRecentSkillActivations(limit: number): Promise<RecentSkillActivatedEvent[]>;
	listUserSkillActivations(window: CohortsWindow): Promise<UserSkillActivation[]>;
	listSessionSkillActivations(window: CohortsWindow): Promise<SessionSkillActivation[]>;
	getDirectStats(): Promise<DirectEventStats>;
}
