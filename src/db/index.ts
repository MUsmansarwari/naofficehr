import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local dev: DATABASE_URL=file:local.db (no auth token).
// Turso:     DATABASE_URL=libsql://…turso.io + DATABASE_AUTH_TOKEN.
const url = process.env.DATABASE_URL ?? "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const globalForDb = globalThis as unknown as { __client?: ReturnType<typeof createClient> };
const client = globalForDb.__client ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__client = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
