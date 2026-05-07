import type { ITokenRepository } from "@/domain/ports/token-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { TokenWithJwt } from "@/domain/token";
import { createIngestionToken, extractJti } from "@/infrastructure/crypto/jwt";

export async function createToken(
	deps: { tokens: ITokenRepository; audit: IAuditRepository },
	input: {
		name: string;
		userLabel?: string | null;
		expiresAt?: Date | null;
		actorEmail: string;
	},
): Promise<TokenWithJwt> {
	const jwt = await createIngestionToken(
		input.name,
		input.userLabel ?? undefined,
		input.expiresAt ?? undefined,
	);
	const jti = extractJti(jwt);
	if (!jti) throw new Error("Failed to extract jti from generated token");

	const token = await deps.tokens.create({
		jti,
		name: input.name,
		userLabel: input.userLabel,
		expiresAt: input.expiresAt,
	});

	await deps.audit.log({
		actorEmail: input.actorEmail,
		action: "token_created",
		target: input.name,
	});

	return { ...token, jwt };
}
