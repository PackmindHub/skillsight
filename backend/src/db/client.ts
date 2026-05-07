import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/config/env";
import * as schema from "./schema";

const pg = postgres(config.DATABASE_URL, { max: 10 });
export const db = drizzle(pg, { schema });
export type AppDb = typeof db;
export { pg as pgClient };
