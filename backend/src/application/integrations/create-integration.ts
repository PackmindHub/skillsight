import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { Integration, CreateIntegrationData } from "@/domain/integration";
import { recordAudit } from "@/application/audit/record-audit";

export async function createIntegration(
	deps: { integrations: IIntegrationRepository; audit: IAuditRepository },
	input: CreateIntegrationData & { actorEmail: string },
): Promise<Integration> {
	const { actorEmail, ...data } = input;
	const row = await deps.integrations.create(data);

	await recordAudit(deps, {
		actorEmail,
		action: "integration_created",
		target: row.id,
		metadata: {
			name: row.name,
			url: row.url,
			authType: row.authType,
			lokiQuery: row.lokiQuery,
			syncIntervalMs: row.syncIntervalMs,
			enabled: row.enabled,
			hasPassword: row.hasPassword,
		},
	});

	const { authPasswordEncrypted: _secret, ...rest } = row;
	return rest;
}
