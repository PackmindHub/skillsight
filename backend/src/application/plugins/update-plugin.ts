import { recordAudit } from "@/application/audit/record-audit";
import type { Plugin, PluginStatus } from "@/domain/plugin";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { IPluginRepository } from "@/domain/ports/plugin-repository";

export async function updatePlugin(
	deps: { plugins: IPluginRepository; audit: IAuditRepository },
	input: {
		pluginName: string;
		status?: PluginStatus;
		actorEmail: string | null;
	},
): Promise<Plugin | { error: "not_found" }> {
	const existing = await deps.plugins.findByName(input.pluginName);
	if (!existing) return { error: "not_found" };

	const updates: { status?: PluginStatus } = {};
	if (input.status !== undefined) updates.status = input.status;

	const updated = await deps.plugins.update(input.pluginName, updates);
	if (!updated) return { error: "not_found" };

	if (input.status !== undefined && input.status !== existing.status) {
		await recordAudit(deps, {
			actorEmail: input.actorEmail,
			action: "plugin_status_changed",
			target: input.pluginName,
			metadata: { from: existing.status, to: input.status, scope: "direct" },
		});
	}

	return updated;
}
