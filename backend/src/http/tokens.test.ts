import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { ZodError } from "zod";
import { createTokensRoute } from "./tokens";
import type { Token } from "@/domain/token";
import type { ITokenRepository } from "@/domain/ports/token-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import {
	createIngestionToken,
	signSessionToken,
	signToken,
} from "@/infrastructure/crypto/jwt";

function makeDeps() {
	const created: Array<{ jti: string; expiresAt?: Date | null }> = [];
	const tokens: ITokenRepository = {
		findAll: async () => [],
		findById: async () => null,
		create: async (data) => {
			created.push({ jti: data.jti, expiresAt: data.expiresAt ?? null });
			return {
				id: "tok-1",
				jti: data.jti,
				name: data.name,
				userLabel: data.userLabel ?? null,
				createdAt: new Date(),
				expiresAt: data.expiresAt ?? null,
				revokedAt: null,
			} satisfies Token;
		},
		revoke: async () => {},
		isRevoked: async () => false,
	};
	const audit: IAuditRepository = {
		log: async () => {},
		listPaginated: async () => ({ items: [], total: 0 }),
	};
	return { tokens, audit, created };
}

function makeApp(deps: { tokens: ITokenRepository; audit: IAuditRepository }) {
	const app = new Hono();
	app.onError((err, c) => {
		if (err instanceof ZodError) return c.json({ error: "Invalid input" }, 400);
		if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON" }, 400);
		return c.json({ error: "Internal server error" }, 500);
	});
	app.route("/api/tokens", createTokensRoute(deps));
	return app;
}

async function authenticatedRequest(app: Hono, body: unknown) {
	const sessionJwt = await signSessionToken(
		{ sub: "user-1", email: "alice@example.com", role: "admin" },
		"1h",
	);
	return app.request("/api/tokens", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: `session=${sessionJwt}`,
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

const FUTURE_ISO = new Date(Date.now() + 86_400_000).toISOString();

describe("POST /api/tokens", () => {
	it("returns 400 when name is empty", async () => {
		const deps = makeDeps();
		const res = await authenticatedRequest(makeApp(deps), {
			name: "",
			expiresAt: FUTURE_ISO,
		});
		expect(res.status).toBe(400);
	});

	it("creates a token with no exp claim when expiresAt is omitted", async () => {
		const deps = makeDeps();
		const res = await authenticatedRequest(makeApp(deps), { name: "ingest" });
		expect(res.status).toBe(201);
		expect(deps.created[0]?.expiresAt).toBeNull();
		const body = (await res.json()) as { jwt: string };
		const [, payloadB64] = body.jwt.split(".");
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
			exp?: number;
		};
		expect(payload.exp).toBeUndefined();
	});

	it("creates a token with no exp claim when expiresAt is null", async () => {
		const deps = makeDeps();
		const res = await authenticatedRequest(makeApp(deps), {
			name: "ingest",
			expiresAt: null,
		});
		expect(res.status).toBe(201);
		expect(deps.created[0]?.expiresAt).toBeNull();
	});

	it("returns 400 when expiresAt is not a valid ISO datetime", async () => {
		const deps = makeDeps();
		const res = await authenticatedRequest(makeApp(deps), {
			name: "ingest",
			expiresAt: "not-a-date",
		});
		expect(res.status).toBe(400);
	});

	it("returns 401 without a session cookie", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/tokens", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "ingest", expiresAt: FUTURE_ISO }),
		});
		expect(res.status).toBe(401);
	});

	it("returns 401 when an ingestion token is passed as the session cookie", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const ingestionJwt = await createIngestionToken("evil", undefined, null);
		const res = await app.request("/api/tokens", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `session=${ingestionJwt}`,
			},
			body: JSON.stringify({ name: "ingest", expiresAt: FUTURE_ISO }),
		});
		expect(res.status).toBe(401);
	});

	it("returns 401 when the session JWT is missing the type=session claim", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const legacyJwt = await signToken(
			{ sub: "user-1", email: "alice@example.com", role: "admin" },
			"1h",
		);
		const res = await app.request("/api/tokens", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `session=${legacyJwt}`,
			},
			body: JSON.stringify({ name: "ingest", expiresAt: FUTURE_ISO }),
		});
		expect(res.status).toBe(401);
	});

	it("returns 403 for a non-admin session", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const sessionJwt = await signSessionToken(
			{ sub: "user-2", email: "bob@example.com", role: "user" },
			"1h",
		);
		const res = await app.request("/api/tokens", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `session=${sessionJwt}`,
			},
			body: JSON.stringify({ name: "ingest", expiresAt: FUTURE_ISO }),
		});
		expect(res.status).toBe(403);
	});

	it("creates a token with an exp claim on valid input", async () => {
		const deps = makeDeps();
		const res = await authenticatedRequest(makeApp(deps), {
			name: "ingest",
			expiresAt: FUTURE_ISO,
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { jwt: string };
		const [, payloadB64] = body.jwt.split(".");
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
			exp?: number;
		};
		expect(typeof payload.exp).toBe("number");
		expect(payload.exp).toBe(Math.floor(new Date(FUTURE_ISO).getTime() / 1000));
	});
});
