import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/infrastructure/crypto/password";
import { config } from "@/config/env";

export async function seedAdmin(): Promise<void> {
	const existing = await db.select({ id: users.id }).from(users).limit(1);
	if (existing.length > 0) return;

	const hash = await hashPassword(config.ADMIN_PASSWORD_INITIAL);
	await db.insert(users).values({
		email: config.ADMIN_EMAIL,
		passwordHash: hash,
		role: "admin",
	});
	console.log(`[bootstrap] Admin user created: ${config.ADMIN_EMAIL}`);
}
