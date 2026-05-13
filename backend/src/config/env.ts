import { z } from "zod";

const schema = z.object({
	DATABASE_URL: z.string().url(),
	JWT_SECRET: z.string().min(32),
	JWT_SECRET_PREVIOUS: z.string().optional(),
	PUBLIC_BASE_URL: z
		.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
	ADMIN_EMAIL: z.string().email(),
	ADMIN_PASSWORD_INITIAL: z.string().min(1),
	PORT: z.coerce.number().optional().default(4200),
	NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

const result = schema.safeParse(process.env);
if (!result.success) {
	console.error("[fatal] Invalid environment variables:");
	for (const [field, issues] of Object.entries(result.error.flatten().fieldErrors)) {
		console.error(`  ${field}: ${issues?.join(", ")}`);
	}
	process.exit(1);
}

export const config = result.data;
