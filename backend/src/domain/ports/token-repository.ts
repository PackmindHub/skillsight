import type { Token } from "@/domain/token";

export interface ITokenRepository {
	findAll(): Promise<Token[]>;
	findById(id: string): Promise<Token | null>;
	create(data: {
		jti: string;
		name: string;
		userLabel?: string | null;
		expiresAt?: Date | null;
	}): Promise<Token>;
	revoke(id: string): Promise<void>;
	isRevoked(jti: string): Promise<boolean>;
}
