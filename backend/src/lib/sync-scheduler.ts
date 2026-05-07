import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { integrations } from "@/db/schema";
import { syncIntegration } from "@/lib/loki-sync";

type Integration = typeof integrations.$inferSelect;

const handles = new Map<string, ReturnType<typeof setInterval>>();

export async function startScheduler(): Promise<void> {
	const rows = await db.select().from(integrations).where(eq(integrations.enabled, true));
	for (const integration of rows) {
		scheduleIntegration(integration);
	}
	console.log(`[scheduler] Started ${rows.length} integration(s)`);
}

export function scheduleIntegration(integration: Integration): void {
	cancelIntegration(integration.id);
	const handle = setInterval(async () => {
		await syncIntegration(integration).catch(() => {});
	}, integration.syncIntervalMs);
	handles.set(integration.id, handle);
}

export async function rescheduleIntegration(id: string): Promise<void> {
	cancelIntegration(id);
	const [integration] = await db
		.select()
		.from(integrations)
		.where(eq(integrations.id, id))
		.limit(1);
	if (integration?.enabled) {
		scheduleIntegration(integration);
	}
}

export function cancelIntegration(id: string): void {
	const handle = handles.get(id);
	if (handle !== undefined) {
		clearInterval(handle);
		handles.delete(id);
	}
}
