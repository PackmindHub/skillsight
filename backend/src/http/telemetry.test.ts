import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { createTelemetryRoute } from "./telemetry";
import type { Token } from "@/domain/token";
import type { ITokenRepository } from "@/domain/ports/token-repository";
import { createIngestionToken, signSessionToken } from "@/infrastructure/crypto/jwt";

function makeDeps() {
	const tokens: ITokenRepository = {
		findAll: async () => [],
		findById: async () => null,
		create: async () =>
			({
				id: "t",
				jti: "j",
				name: "n",
				userLabel: null,
				createdAt: new Date(),
				expiresAt: null,
				revokedAt: null,
			}) satisfies Token,
		revoke: async () => {},
		isRevoked: async () => false,
	};
	return {
		tokens,
		events: {
			insertMany: async () => {},
			findFiltered: async () => [],
			countByUser: async () => [],
		} as never,
		marketplaces: { findAll: async () => [] } as never,
		plugins: { findAll: async () => [] } as never,
	};
}

function makeApp(deps: ReturnType<typeof makeDeps>) {
	const app = new Hono();
	app.route("/api/v0/telemetry", createTelemetryRoute(deps));
	return app;
}

async function bearerHeader(): Promise<string> {
	const exp = new Date(Date.now() + 60_000);
	const jwt = await createIngestionToken("test", undefined, exp);
	return `Bearer ${jwt}`;
}

describe("POST /api/v0/telemetry/v1/logs", () => {
	it("returns 401 without an Authorization header", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/v0/telemetry/v1/logs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		expect(res.status).toBe(401);
	});

	it("returns 401 when a session JWT is presented as the Bearer token", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const sessionJwt = await signSessionToken(
			{ sub: "user-1", email: "alice@example.com", role: "admin" },
			"1h",
		);
		const res = await app.request("/api/v0/telemetry/v1/logs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${sessionJwt}`,
			},
			body: JSON.stringify({ resourceLogs: [] }),
		});
		expect(res.status).toBe(401);
	});

	it("returns 400 with partialSuccess on invalid JSON body", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/v0/telemetry/v1/logs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: await bearerHeader(),
			},
			body: "{not-json",
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as {
			partialSuccess: { rejectedLogRecords: number; errorMessage: string };
		};
		expect(body.partialSuccess.rejectedLogRecords).toBe(1);
		expect(body.partialSuccess.errorMessage).toBe("Invalid JSON");
	});

	it("returns 200 with partialSuccess on a valid empty OTLP body", async () => {
		const deps = makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/v0/telemetry/v1/logs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: await bearerHeader(),
			},
			body: JSON.stringify({ resourceLogs: [] }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { partialSuccess: Record<string, unknown> };
		expect(body.partialSuccess).toBeDefined();
	});
});
