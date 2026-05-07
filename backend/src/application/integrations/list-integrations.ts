import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { Integration } from "@/domain/integration";

export async function listIntegrations(
	deps: { integrations: IIntegrationRepository },
): Promise<Array<Integration & { eventCount: number }>> {
	const [rows, countMap] = await Promise.all([
		deps.integrations.findAll(),
		deps.integrations.countEventsByIntegration(),
	]);

	return rows.map(({ authPasswordEncrypted: _secret, ...rest }) => ({
		...rest,
		eventCount: countMap.get(rest.id) ?? 0,
	}));
}
