const SECRET_KEYS = new Set([
	"password",
	"passwordhash",
	"password_hash",
	"token",
	"accesstoken",
	"access_token",
	"accesstokenencrypted",
	"access_token_encrypted",
	"authpassword",
	"auth_password",
	"authpasswordencrypted",
	"auth_password_encrypted",
	"secret",
	"jti",
	"authorization",
	"jwt",
	"apikey",
	"api_key",
	"sessiontoken",
	"session_token",
]);

const REDACTED = "[REDACTED]";

export function redactSecrets(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) return value.map(redactSecrets);
	if (typeof value !== "object") return value;

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (SECRET_KEYS.has(k.toLowerCase())) {
			out[k] = v == null ? v : REDACTED;
		} else {
			out[k] = redactSecrets(v);
		}
	}
	return out;
}
