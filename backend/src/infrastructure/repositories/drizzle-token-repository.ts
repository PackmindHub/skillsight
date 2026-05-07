import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { tokens, revokedTokens } from "@/db/schema";
import type { ITokenRepository } from "@/domain/ports/token-repository";
import type { Token } from "@/domain/token";

export class DrizzleTokenRepository implements ITokenRepository {
	constructor(private readonly db: AppDb) {}

	async findAll(): Promise<Token[]> {
		return this.db.select().from(tokens).orderBy(tokens.createdAt);
	}

	async findById(id: string): Promise<Token | null> {
		const [row] = await this.db.select().from(tokens).where(eq(tokens.id, id)).limit(1);
		return row ?? null;
	}

	async create(data: {
		jti: string;
		name: string;
		userLabel?: string | null;
		expiresAt?: Date | null;
	}): Promise<Token> {
		const [row] = await this.db
			.insert(tokens)
			.values({
				jti: data.jti,
				name: data.name,
				userLabel: data.userLabel ?? null,
				expiresAt: data.expiresAt ?? null,
			})
			.returning();
		return row;
	}

	async revoke(id: string): Promise<void> {
		const [token] = await this.db.select().from(tokens).where(eq(tokens.id, id)).limit(1);
		if (!token) return;
		await this.db.insert(revokedTokens).values({ jti: token.jti }).onConflictDoNothing();
		await this.db.update(tokens).set({ revokedAt: new Date() }).where(eq(tokens.id, id));
	}

	async isRevoked(jti: string): Promise<boolean> {
		const rows = await this.db
			.select({ jti: revokedTokens.jti })
			.from(revokedTokens)
			.where(eq(revokedTokens.jti, jti))
			.limit(1);
		return rows.length > 0;
	}
}
