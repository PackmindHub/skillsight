import type {
	IntegrationWithSecret,
	CreateIntegrationData,
	UpdateIntegrationData,
} from "@/domain/integration";

export interface IIntegrationRepository {
	findAll(): Promise<IntegrationWithSecret[]>;
	findById(id: string): Promise<IntegrationWithSecret | null>;
	create(data: CreateIntegrationData): Promise<IntegrationWithSecret>;
	update(id: string, data: UpdateIntegrationData): Promise<IntegrationWithSecret>;
	delete(id: string): Promise<void>;
	updateSyncStatus(
		id: string,
		status: { lastSyncAt?: Date | null; lastSyncError?: string | null },
	): Promise<void>;
	countEventsByIntegration(): Promise<Map<string, number>>;
	countEventsByIntegrationId(id: string): Promise<number>;
}
