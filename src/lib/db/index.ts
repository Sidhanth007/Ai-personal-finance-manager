import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

/**
 * Reuse one postgres client across hot reloads in development so we do not
 * exhaust the Neon connection pool.
 */
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // required for Neon's pooled (pgbouncer) endpoint
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
