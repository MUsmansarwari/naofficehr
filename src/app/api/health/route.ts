import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deployment self-check — says whether configuration is present and the
 * database answers. Never echoes a secret. Public on purpose: it reveals
 * nothing beyond "configured / not configured".
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const report: Record<string, unknown> = {
    database_url: url ? (url.startsWith("file:") ? "file (local only)" : url.split("://")[0] + "://…") : "MISSING",
    database_auth_token: process.env.DATABASE_AUTH_TOKEN ? "set" : "MISSING",
    admin_password: process.env.ADMIN_PASSWORD ? "set" : "MISSING",
    session_secret: (process.env.SESSION_SECRET?.length ?? 0) >= 16 ? "set" : "MISSING or too short",
    runtime: process.version,
  };
  try {
    const { db } = await import("@/db");
    const [row] = await db.all<{ n: number }>(sql`select count(*) as n from companies`);
    report.database = `ok — ${row?.n ?? 0} compan${row?.n === 1 ? "y" : "ies"}`;
  } catch (e) {
    report.database = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
