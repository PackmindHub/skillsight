import type { IUserRepository } from "@/domain/ports/user-repository";
import type { User } from "@/domain/user";

export async function getCurrentUser(
	deps: { users: IUserRepository },
	email: string,
): Promise<User | null> {
	return deps.users.findByEmail(email);
}
