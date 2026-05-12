import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "@/config/env";

function encodeSecret(secret: string) {
	return new TextEncoder().encode(secret);
}

export async function signToken(
	payload: Record<string, unknown>,
	expiresIn: string | number,
): Promise<string> {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(encodeSecret(config.JWT_SECRET));
}

export async function verifyToken(token: string): Promise<JWTPayload> {
	const secrets = [config.JWT_SECRET, config.JWT_SECRET_PREVIOUS].filter(Boolean) as string[];
	let lastError: unknown;
	for (const secret of secrets) {
		try {
			const { payload } = await jwtVerify(token, encodeSecret(secret));
			return payload;
		} catch (err) {
			lastError = err;
		}
	}
	throw lastError;
}

export async function createIngestionToken(
	name: string,
	userLabel: string | undefined,
	expiresAt: Date | null,
): Promise<string> {
	const jti = crypto.randomUUID();
	const builder = new SignJWT({ jti, name, userLabel, type: "ingestion" })
		.setProtectedHeader({ alg: "HS256" })
		.setJti(jti)
		.setIssuedAt();
	if (expiresAt) builder.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
	return builder.sign(encodeSecret(config.JWT_SECRET));
}

export function extractJti(token: string): string | undefined {
	try {
		const [, payloadB64] = token.split(".");
		if (!payloadB64) return undefined;
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as JWTPayload;
		return payload.jti ?? undefined;
	} catch {
		return undefined;
	}
}
