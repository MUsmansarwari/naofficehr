import "server-only";
import { asc } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/db";
import type { Company } from "@/db/schema";

export const COMPANY_COOKIE = "na_company";

export const listCompanies = cache(async (): Promise<Company[]> => {
  return db.select().from(schema.companies).orderBy(asc(schema.companies.name));
});

/** Active company = cookie if it still exists, else the first one. Null when none exist. */
export const getActiveCompany = cache(async (): Promise<Company | null> => {
  const all = await listCompanies();
  if (all.length === 0) return null;
  const jar = await cookies();
  const wanted = Number(jar.get(COMPANY_COOKIE)?.value);
  return all.find((c) => c.id === wanted) ?? all[0];
});

/** Like getActiveCompany but throws — for pages that cannot render without one. */
export async function requireActiveCompany(): Promise<Company> {
  const c = await getActiveCompany();
  if (!c) throw new Error("No company configured");
  return c;
}
