import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/types";
import type { AppDeps } from "@/bootstrap/compose";
import { sessionAuth } from "@/middleware/session-auth";
import { requireAdmin } from "@/middleware/require-admin";
import { listTokens } from "@/application/tokens/list-tokens";
import { createToken } from "@/application/tokens/create-token";
import { revokeToken } from "@/application/tokens/revoke-token";

const createTokenSchema = z.object({
	name: z.string().min(1).max(255),
	userLabel: z.string().max(255).optional().nullable(),
	expiresAt: z
		.string()
		.datetime()
		.optional()
		.nullable()
		.transform((v) => (v ? v : null)),
});

export function createTokensRoute(deps: Pick<AppDeps, "tokens" | "audit">) {
	const route = new Hono<{ Variables: AppVariables }>();
	route.use("*", sessionAuth);
	route.use("*", requireAdmin);

	route.get("/", async (c) => {
		return c.json(await listTokens(deps));
	});

	route.post("/", async (c) => {
		const { name, userLabel, expiresAt } = createTokenSchema.parse(await c.req.json());
		const result = await createToken(deps, {
			name,
			userLabel,
			expiresAt: expiresAt ? new Date(expiresAt) : null,
			actorEmail: c.get("user").email,
		});
		return c.json(result, 201);
	});

	route.delete("/:id", async (c) => {
		const result = await revokeToken(deps, {
			id: c.req.param("id"),
			actorEmail: c.get("user").email,
		});
		if (result && "error" in result) {
			return result.error === "not_found"
				? c.json({ error: "Not found" }, 404)
				: c.json({ error: "Already revoked" }, 409);
		}
		return c.body(null, 204);
	});

	return route;
}
