import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IEventRepository } from "@/domain/ports/event-repository";
import { recordAudit } from "@/application/audit/record-audit";

export async function clearDirectData(
	deps: { events: IEventRepository; audit: IAuditRepository },
	input: { actorEmail: string },
): Promise<void> {
	await deps.events.deleteDirectEvents();

	await recordAudit(deps, {
		actorEmail: input.actorEmail,
		action: "direct_telemetry_data_cleared",
		target: "direct",
	});
}
