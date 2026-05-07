import type { ITokenRepository } from "@/domain/ports/token-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";

export async function revokeToken(
	deps: { tokens: ITokenRepository; audit: IAuditRepository },
	input: { id: string; actorEmail: string },
): Promise<undefined | { error: "not_found" | "already_revoked" }> {
	const token = await deps.tokens.findById(input.id);
	if (!token) return { error: "not_found" };
	if (token.revokedAt) return { error: "already_revoked" };

	await deps.tokens.revoke(input.id);

	await deps.audit.log({
		actorEmail: input.actorEmail,
		action: "token_revoked",
		target: token.name,
	});
}
