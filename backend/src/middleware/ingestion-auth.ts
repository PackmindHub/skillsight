import { createMiddleware } from "hono/factory";
import type { ITokenRepository } from "@/domain/ports/token-repository";
import { verifyToken } from "@/infrastructure/crypto/jwt";
import type { AppVariables } from "@/types";

export function ingestionAuth(tokens: ITokenRepository) {
	return createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
		const authHeader = c.req.header("Authorization");
		if (!authHeader?.startsWith("Bearer ")) return c.json({}, 401);

		const token = authHeader.slice(7);
		let jti: string;
		try {
			const payload = await verifyToken(token);
			if (!payload.jti) return c.json({}, 401);
			jti = payload.jti;
		} catch {
			return c.json({}, 401);
		}

		const revoked = await tokens.isRevoked(jti);
		if (revoked) return c.json({}, 401);

		c.set("tokenJti", jti);
		await next();
	});
}
