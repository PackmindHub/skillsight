import type { Context } from "hono";
import { config } from "@/config/env";

function fromForwardedHeaders(c: Context): string | null {
	const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
	const host = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() ?? c.req.header("host");
	if (!host) return null;
	const scheme = proto ?? new URL(c.req.url).protocol.replace(":", "");
	return `${scheme}://${host}`;
}

export function getBaseUrl(c: Context): string {
	if (config.PUBLIC_BASE_URL) return config.PUBLIC_BASE_URL;
	const forwarded = fromForwardedHeaders(c);
	if (forwarded) return forwarded;
	const url = new URL(c.req.url);
	return `${url.protocol}//${url.host}`;
}

export function isHttps(c: Context): boolean {
	const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
	if (proto) return proto === "https";
	return new URL(c.req.url).protocol === "https:";
}
