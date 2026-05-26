import type { CoUsageSession } from "@/types/api";

export interface Combo {
	id: string;
	skills: string[];
	size: number;
	sessions: CoUsageSession[];
	sessionCount: number;
	userCount: number;
	users: string[];
	totalActivations: number;
	lastSeenAt: string;
}
