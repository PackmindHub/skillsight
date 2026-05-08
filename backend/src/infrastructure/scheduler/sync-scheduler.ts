import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IntegrationWithSecret } from "@/domain/integration";

type SyncFn = (integration: IntegrationWithSecret) => Promise<unknown>;

// Stored on globalThis so Bun's --hot in-process reload doesn't lose live handles
const g = globalThis as Record<string, unknown>;
g.__syncHandles ??= new Map<string, ReturnType<typeof setInterval>>();
const handles = g.__syncHandles as Map<string, ReturnType<typeof setInterval>>;

export async function startScheduler(
	integrationRepo: IIntegrationRepository,
	syncFn: SyncFn,
): Promise<void> {
	const integrations = await integrationRepo.findAll();
	const enabled = integrations.filter((i) => i.enabled);
	for (const integration of enabled) {
		scheduleIntegration(integration, syncFn);
	}
	console.log(`[scheduler] Started ${enabled.length} integration(s)`);
}

export function scheduleIntegration(integration: IntegrationWithSecret, syncFn: SyncFn): void {
	cancelIntegration(integration.id);
	const handle = setInterval(async () => {
		await syncFn(integration).catch(() => {});
	}, integration.syncIntervalMs);
	handles.set(integration.id, handle);
}

export async function rescheduleIntegration(
	id: string,
	integrationRepo: IIntegrationRepository,
	syncFn: SyncFn,
): Promise<void> {
	cancelIntegration(id);
	const integration = await integrationRepo.findById(id);
	if (integration?.enabled) {
		scheduleIntegration(integration, syncFn);
	}
}

export function cancelIntegration(id: string): void {
	const handle = handles.get(id);
	if (handle !== undefined) {
		clearInterval(handle);
		handles.delete(id);
	}
}
