import type { User } from "@/domain/user";

export interface IUserRepository {
	findByEmail(email: string): Promise<User | null>;
	findById(id: string): Promise<User | null>;
	findPasswordHash(email: string): Promise<string | null>;
	markOnboardingComplete(email: string): Promise<void>;
}
