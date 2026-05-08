import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import { recordAudit } from "@/application/audit/record-audit";

export async function deleteIntegration(
	deps: { integrations: IIntegrationRepository; audit: IAuditRepository },
	input: { id: string; actorEmail: string },
): Promise<undefined | { error: "not_found" }> {
	const existing = await deps.integrations.findById(input.id);
	if (!existing) return { error: "not_found" };

	await deps.integrations.delete(input.id);

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "integration_deleted",
		target: existing.id,
		metadata: { name: existing.name, url: existing.url },
	});
}
