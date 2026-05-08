import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { ZodError } from "zod";
import { createAuthRoute } from "./auth";
import type { User } from "@/domain/user";
import type { IUserRepository } from "@/domain/ports/user-repository";
import type { IAuditRepository } from "@/domain/ports/audit-repository";
import { hashPassword } from "@/infrastructure/crypto/password";

const ALICE: User = {
	id: "user-1",
	email: "alice@example.com",
	role: "admin",
	onboardingCompletedAt: new Date(),
	createdAt: new Date(),
};

async function makeDeps(opts?: { passwordHash?: string }) {
	const passwordHash = opts?.passwordHash ?? (await hashPassword("hunter22"));
	const auditCalls: Array<{ actorEmail: string | null; action: string }> = [];
	const users: IUserRepository = {
		findByEmail: async (email) => (email === ALICE.email ? ALICE : null),
		findById: async () => null,
		findPasswordHash: async (email) => (email === ALICE.email ? passwordHash : null),
		markOnboardingComplete: async () => {},
	};
	const audit: IAuditRepository = {
		log: async (entry) => {
			auditCalls.push({ actorEmail: entry.actorEmail, action: entry.action });
		},
		listPaginated: async () => ({ items: [], total: 0 }),
	};
	return { users, audit, auditCalls };
}

function makeApp(deps: { users: IUserRepository; audit: IAuditRepository }) {
	const app = new Hono();
	app.onError((err, c) => {
		if (err instanceof ZodError) return c.json({ error: "Invalid input" }, 400);
		if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON" }, 400);
		return c.json({ error: "Internal server error" }, 500);
	});
	app.route("/api/auth", createAuthRoute(deps));
	return app;
}

describe("POST /api/auth/login", () => {
	it("returns 400 when body is missing fields", async () => {
		const deps = await makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it("returns 400 when email is malformed", async () => {
		const deps = await makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "not-an-email", password: "x" }),
		});
		expect(res.status).toBe(400);
	});

	it("returns 400 when JSON is malformed", async () => {
		const deps = await makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{not-json",
		});
		expect(res.status).toBe(400);
	});

	it("returns 401 on invalid credentials", async () => {
		const deps = await makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: ALICE.email, password: "wrong" }),
		});
		expect(res.status).toBe(401);
	});

	it("returns 200 and sets session cookie on valid credentials", async () => {
		const deps = await makeDeps();
		const app = makeApp(deps);
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: ALICE.email, password: "hunter22" }),
		});
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("session=");
		expect(setCookie.toLowerCase()).toContain("httponly");
	});
});
