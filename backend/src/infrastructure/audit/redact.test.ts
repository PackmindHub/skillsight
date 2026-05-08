import { describe, expect, it } from "bun:test";
import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
	it("redacts top-level secret-named keys", () => {
		const result = redactSecrets({
			email: "user@example.com",
			password: "hunter2",
			token: "tok-123",
			accessToken: "at-456",
			authorization: "Bearer xyz",
		}) as Record<string, unknown>;

		expect(result.email).toBe("user@example.com");
		expect(result.password).toBe("[REDACTED]");
		expect(result.token).toBe("[REDACTED]");
		expect(result.accessToken).toBe("[REDACTED]");
		expect(result.authorization).toBe("[REDACTED]");
	});

	it("preserves null values", () => {
		const result = redactSecrets({ password: null, token: null }) as Record<string, unknown>;
		expect(result.password).toBeNull();
		expect(result.token).toBeNull();
	});

	it("redacts nested keys", () => {
		const result = redactSecrets({
			before: { name: "x", access_token: "secret" },
			after: { name: "y", access_token: "newsecret" },
		}) as { before: { access_token: string }; after: { access_token: string } };

		expect(result.before.access_token).toBe("[REDACTED]");
		expect(result.after.access_token).toBe("[REDACTED]");
	});

	it("redacts keys inside arrays", () => {
		const result = redactSecrets([
			{ name: "a", password: "p1" },
			{ name: "b", password: "p2" },
		]) as Array<Record<string, unknown>>;
		expect(result[0].password).toBe("[REDACTED]");
		expect(result[1].password).toBe("[REDACTED]");
	});

	it("is case-insensitive on keys", () => {
		const result = redactSecrets({ Password: "x", AccessToken: "y" }) as Record<string, unknown>;
		expect(result.Password).toBe("[REDACTED]");
		expect(result.AccessToken).toBe("[REDACTED]");
	});

	it("leaves primitives untouched", () => {
		expect(redactSecrets("hello")).toBe("hello");
		expect(redactSecrets(42)).toBe(42);
		expect(redactSecrets(null)).toBeNull();
		expect(redactSecrets(undefined)).toBeUndefined();
	});
});
