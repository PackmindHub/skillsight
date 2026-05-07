import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { Integration, CreateIntegrationData } from "@/domain/integration";

export async function createIntegration(
	deps: { integrations: IIntegrationRepository; audit: IAuditRepository },
	input: CreateIntegrationData & { actorEmail: string },
): Promise<Integration> {
	const { actorEmail, ...data } = input;
	const row = await deps.integrations.create(data);

	await deps.audit.log({
		actorEmail,
		action: "integration_created",
		target: data.name,
	});

	const { authPasswordEncrypted: _secret, ...rest } = row;
	return rest;
}
