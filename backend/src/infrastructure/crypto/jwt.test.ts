import { describe, expect, it } from "bun:test";
import { createIngestionToken, extractJti, verifyToken } from "./jwt";

function decodePayload(jwt: string): Record<string, unknown> {
	const [, payloadB64] = jwt.split(".");
	return JSON.parse(Buffer.from(payloadB64, "base64url").toString());
}

describe("createIngestionToken", () => {
	it("sets the exp claim from expiresAt", async () => {
		const expiresAt = new Date(Date.now() + 86_400_000);
		const jwt = await createIngestionToken("ingest", undefined, expiresAt);
		const payload = decodePayload(jwt);
		expect(payload.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
	});

	it("includes a jti and the ingestion type", async () => {
		const jwt = await createIngestionToken("ingest", undefined, new Date(Date.now() + 60_000));
		const payload = decodePayload(jwt);
		expect(typeof payload.jti).toBe("string");
		expect(payload.type).toBe("ingestion");
		expect(extractJti(jwt)).toBe(payload.jti as string);
	});
});

describe("verifyToken", () => {
	it("rejects an ingestion token whose exp is in the past", async () => {
		const past = new Date(Date.now() - 60_000);
		const jwt = await createIngestionToken("expired", undefined, past);
		await expect(verifyToken(jwt)).rejects.toBeDefined();
	});

	it("accepts an ingestion token whose exp is in the future", async () => {
		const future = new Date(Date.now() + 60_000);
		const jwt = await createIngestionToken("ok", undefined, future);
		const payload = await verifyToken(jwt);
		expect(payload.type).toBe("ingestion");
	});
});
