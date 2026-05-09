import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import { recordAudit } from "@/application/audit/record-audit";

export async function clearIntegrationData(
	deps: { integrations: IIntegrationRepository; events: IEventRepository; audit: IAuditRepository },
	input: { id: string; actorEmail: string },
): Promise<undefined | { error: "not_found" }> {
	const existing = await deps.integrations.findById(input.id);
	if (!existing) return { error: "not_found" };

	await deps.events.deleteByIntegrationId(input.id);
	await deps.integrations.updateSyncStatus(input.id, { lastSyncAt: null, lastSyncError: null });

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "integration_data_cleared",
		target: existing.id,
		metadata: { name: existing.name },
	});
}
