import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { users } from "@/db/schema";
import type { IUserRepository } from "@/domain/ports/user-repository";
import type { User } from "@/domain/user";

export class DrizzleUserRepository implements IUserRepository {
	constructor(private readonly db: AppDb) {}

	async findByEmail(email: string): Promise<User | null> {
		const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
		return row ?? null;
	}

	async findById(id: string): Promise<User | null> {
		const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
		return row ?? null;
	}

	async markOnboardingComplete(email: string): Promise<void> {
		await this.db
			.update(users)
			.set({ onboardingCompletedAt: new Date() })
			.where(eq(users.email, email));
	}

	async findPasswordHash(email: string): Promise<string | null> {
		const [row] = await this.db
			.select({ passwordHash: users.passwordHash })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		return row?.passwordHash ?? null;
	}
}
