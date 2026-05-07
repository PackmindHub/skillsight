import type { IUserRepository } from "@/domain/ports/user-repository";

export async function completeOnboarding(
	deps: { users: IUserRepository },
	email: string,
): Promise<void> {
	await deps.users.markOnboardingComplete(email);
}
