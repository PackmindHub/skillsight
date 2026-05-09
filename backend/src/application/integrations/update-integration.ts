import type { IIntegrationRepository } from "@/domain/ports/integration-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { AuditAction } from "@/domain/audit";
import type { Integration, UpdateIntegrationData } from "@/domain/integration";
import { recordAudit } from "@/application/audit/record-audit";
import { buildDiff } from "@/application/audit/diff";

const DIFF_FIELDS = [
	"name",
	"url",
	"authType",
	"authUsername",
	"hasPassword",
	"lokiQuery",
	"syncIntervalMs",
	"enabled",
] as const;

export interface UpdateIntegrationOptions {
	auditAction?: AuditAction;
}

export async function updateIntegration(
	deps: { integrations: IIntegrationRepository; audit: IAuditRepository },
	input: { id: string; data: UpdateIntegrationData; actorEmail: string },
	options: UpdateIntegrationOptions = {},
): Promise<Integration | { error: "not_found" }> {
	const existing = await deps.integrations.findById(input.id);
	if (!existing) return { error: "not_found" };

	const row = await deps.integrations.update(input.id, input.data);

	const beforeView = pick(existing, DIFF_FIELDS);
	const afterView = pick(row, DIFF_FIELDS);
	const diff = buildDiff(beforeView, afterView, DIFF_FIELDS);
	const action = options.auditAction ?? "integration_updated";

	if (diff || action !== "integration_updated") {
		await recordAudit(deps, {
			actorEmail: input.actorEmail,
			action,
			target: row.id,
			metadata: {
				name: row.name,
				...(diff ? diff : {}),
			},
		});
	}

	const { authPasswordEncrypted: _secret, ...rest } = row;
	return rest;
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
	const out = {} as Pick<T, K>;
	for (const k of keys) out[k] = obj[k];
	return out;
}
