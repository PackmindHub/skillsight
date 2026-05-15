import type { IUserRepository } from "@/domain/ports/user-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import type { User } from "@/domain/user";
import { verifyPassword } from "@/infrastructure/crypto/password";
import { signSessionToken } from "@/infrastructure/crypto/jwt";

interface LoginDeps {
	users: IUserRepository;
	audit: IAuditRepository;
}

export async function login(
	deps: LoginDeps,
	input: { email: string; password: string },
): Promise<{ user: User; sessionJwt: string } | { error: "invalid_credentials" }> {
	const [user, passwordHash] = await Promise.all([
		deps.users.findByEmail(input.email),
		deps.users.findPasswordHash(input.email),
	]);

	if (!user || !passwordHash) return { error: "invalid_credentials" };

	const valid = await verifyPassword(passwordHash, input.password);
	if (!valid) return { error: "invalid_credentials" };

	const sessionJwt = await signSessionToken(
		{ sub: user.id, email: user.email, role: user.role },
		"1d",
	);

	await deps.audit.log({ actorEmail: input.email, action: "login" });

	return { user, sessionJwt };
}
