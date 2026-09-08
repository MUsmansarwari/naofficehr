import type { Client } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local dev: DATABASE_URL=file:local.db — needs the native libsql binary, so it is
// imported lazily and only on that path. Production (Turso): libsql://… + token,
// served by the pure-fetch web client, which runs anywhere including serverless.
const url = process.env.DATABASE_URL ?? "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

async function makeClient(): Promise<Client> {
  if (url.startsWith("file:")) {
    if (process.env.NETLIFY || process.env.VERCEL) {
      throw new Error("DATABASE_URL must be a Turso libsql:// URL in production — set it in the host's environment variables");
    }
    const { createClient } = await import("@libsql/client");
    return createClient({ url });
  }
  return createWebClient({ url, authToken });
}

const globalForDb = globalThis as unknown as { __client?: Client };
const client = globalForDb.__client ?? (await makeClient());
if (process.env.NODE_ENV !== "production") globalForDb.__client = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
