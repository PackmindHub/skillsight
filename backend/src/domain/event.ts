export interface ParsedEvent {
	userEmail: string | null;
	sessionId: string | null;
	eventName: string;
	timestamp: Date;
	attributes: Record<string, unknown>;
}

export interface NewEvent extends ParsedEvent {
	source: "direct" | "integration";
	sourceIntegrationId?: string | null;
}
