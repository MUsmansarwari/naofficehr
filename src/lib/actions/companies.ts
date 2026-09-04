"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { fromZod, str, type FormState } from "@/lib/form";
import { switchCompany } from "./session";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use hh:mm");

const companySchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z
    .string()
    .min(2, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  timezone: z.string().min(3),
  currency: z.string().min(3).max(3),
  salaryDivisor: z.coerce.number().int().min(1).max(31),
  shiftStart: hhmm,
  shiftEnd: hhmm,
  weeklyOffs: z.array(z.coerce.number().int().min(0).max(6)),
  defaultProbationMonths: z.coerce.number().int().min(0).max(12),
  defaultLeaveQuota: z.coerce.number().int().min(0).max(60),
  deductPublicHolidaysInProbation: z.boolean(),
  checkinEnabled: z.boolean(),
});

function parseCompany(fd: FormData) {
  return companySchema.safeParse({
    name: str(fd, "name"),
    slug: str(fd, "slug").toLowerCase(),
    timezone: str(fd, "timezone"),
    currency: str(fd, "currency").toUpperCase(),
    salaryDivisor: str(fd, "salaryDivisor"),
    shiftStart: str(fd, "shiftStart"),
    shiftEnd: str(fd, "shiftEnd"),
    weeklyOffs: fd.getAll("weeklyOffs").map(String),
    defaultProbationMonths: str(fd, "defaultProbationMonths"),
    defaultLeaveQuota: str(fd, "defaultLeaveQuota"),
    deductPublicHolidaysInProbation: fd.get("deductPublicHolidaysInProbation") === "on",
    checkinEnabled: fd.get("checkinEnabled") === "on",
  });
}

export async function createCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseCompany(fd);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const [row] = await db.insert(schema.companies).values(parsed.data).returning();
    await logAudit({ entityType: "company", entityId: row.id, action: "create", after: row });
    await switchCompany(row.id);
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { fieldErrors: { slug: "Slug already used" }, error: "Slug already used" };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCompany(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseCompany(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const [before] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
  if (!before) return { error: "Company not found" };
  try {
    const [after] = await db.update(schema.companies).set(parsed.data).where(eq(schema.companies.id, id)).returning();
    await logAudit({ entityType: "company", entityId: id, action: "update", before, after });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { fieldErrors: { slug: "Slug already used" }, error: "Slug already used" };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
