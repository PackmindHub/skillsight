import type { ITokenRepository } from "@/domain/ports/token-repository";
import type { Token } from "@/domain/token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function listTokens(
	deps: { tokens: ITokenRepository },
): Promise<Array<Token & { expiresSoon: boolean }>> {
	const rows = await deps.tokens.findAll();
	const now = new Date();
	return rows.map((t) => ({
		...t,
		expiresSoon:
			t.expiresAt !== null &&
			t.revokedAt === null &&
			t.expiresAt.getTime() - now.getTime() < SEVEN_DAYS_MS &&
			t.expiresAt > now,
	}));
}
