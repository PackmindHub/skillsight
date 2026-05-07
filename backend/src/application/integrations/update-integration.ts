import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { Integration, UpdateIntegrationData } from "@/domain/integration";

export async function updateIntegration(
	deps: { integrations: IIntegrationRepository; audit: IAuditRepository },
	input: { id: string; data: UpdateIntegrationData; actorEmail: string },
): Promise<Integration | { error: "not_found" }> {
	const existing = await deps.integrations.findById(input.id);
	if (!existing) return { error: "not_found" };

	const row = await deps.integrations.update(input.id, input.data);

	await deps.audit.log({
		actorEmail: input.actorEmail,
		action: "integration_updated",
		target: row.name,
	});

	const { authPasswordEncrypted: _secret, ...rest } = row;
	return rest;
}
