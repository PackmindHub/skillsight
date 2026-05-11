import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import { eventBus } from "@/lib/event-bus";

export async function publishIntegrationUpdate(
	integrations: IIntegrationRepository,
	id: string,
): Promise<void> {
	const row = await integrations.findById(id);
	if (!row) return;
	const eventCount = await integrations.countEventsByIntegrationId(id);
	const { authPasswordEncrypted: _secret, ...rest } = row;
	eventBus.emitIntegrationUpdated({ ...rest, eventCount });
}
