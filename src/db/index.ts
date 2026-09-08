import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Production (Turso): libsql:// URL + token, served by the pure-fetch web client,
 * which needs no native binary and so runs in a serverless function.
 * Local dev: DATABASE_URL=file:local.db, which does need the native `libsql`
 * package. It is required at runtime through `process.getBuiltinModule`, which a
 * bundler cannot see through, so that binary never ends up in a deployed build.
 *
 * Nothing connects until the first query: `next build` imports every route
 * module to collect its config, and a build must never need database access.
 */
function connect(): Client {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — add it to .env.local, or to the host's environment variables");
  }
  if (url.startsWith("file:")) {
    const nodeRequire = process.getBuiltinModule("module").createRequire(join(process.cwd(), "package.json"));
    const native = nodeRequire("@libsql/client") as typeof import("@libsql/client");
    return native.createClient({ url });
  }
  return createWebClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
}

type Database = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Database };

function instance(): Database {
  if (!globalForDb.__db) globalForDb.__db = drizzle(connect(), { schema });
  return globalForDb.__db;
}

export const db = new Proxy({} as Database, {
  get: (_target, prop, receiver) => Reflect.get(instance(), prop, receiver),
  has: (_target, prop) => prop in instance(),
});

export type Db = Database;
export { schema };
