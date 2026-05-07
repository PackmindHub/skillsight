export interface Token {
	id: string;
	jti: string;
	name: string;
	userLabel: string | null;
	createdAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
}

export interface TokenWithJwt extends Token {
	jwt: string;
}
