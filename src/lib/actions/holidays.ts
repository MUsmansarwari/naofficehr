"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireActiveCompany } from "@/lib/company";
import { str, type FormState } from "@/lib/form";
import { PRESETS, type PresetKey } from "@/lib/holidays/presets";

export async function addHoliday(_prev: FormState, fd: FormData): Promise<FormState> {
  const company = await requireActiveCompany();
  const date = str(fd, "date");
  const name = str(fd, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date", fieldErrors: { date: "Required" } };
  if (!name) return { error: "Name is required", fieldErrors: { name: "Required" } };
  // Re-adding a date that was deactivated just reactivates it with the new name.
  const [row] = await db
    .insert(schema.holidays)
    .values({ companyId: company.id, date, name, source: "custom", isActive: true })
    .onConflictDoUpdate({
      target: [schema.holidays.companyId, schema.holidays.date],
      set: { name, source: "custom", isActive: true },
    })
    .returning();
  await logAudit({ entityType: "holiday", entityId: row.id, action: "create", after: row });
  revalidatePath("/holidays");
  return { ok: true };
}

export async function renameHoliday(id: number, name: string) {
  const company = await requireActiveCompany();
  const [before] = await db.select().from(schema.holidays).where(and(eq(schema.holidays.id, id), eq(schema.holidays.companyId, company.id)));
  if (!before || !name.trim()) return;
  const [after] = await db.update(schema.holidays).set({ name: name.trim() }).where(eq(schema.holidays.id, id)).returning();
  await logAudit({ entityType: "holiday", entityId: id, action: "update", before, after });
  revalidatePath("/holidays");
}

/** "Remove" = deactivate (build-spec §2). Toggle back to restore. */
export async function setHolidayActive(id: number, isActive: boolean) {
  const company = await requireActiveCompany();
  const [before] = await db.select().from(schema.holidays).where(and(eq(schema.holidays.id, id), eq(schema.holidays.companyId, company.id)));
  if (!before) return;
  const [after] = await db.update(schema.holidays).set({ isActive }).where(eq(schema.holidays.id, id)).returning();
  await logAudit({ entityType: "holiday", entityId: id, action: "update", before, after, note: isActive ? "Restored" : "Removed" });
  revalidatePath("/holidays");
}

/** Upsert a preset for a year. Custom-named rows on the same date keep their name. */
export async function importPreset(key: PresetKey, year: number): Promise<{ added: number; skipped: number }> {
  const company = await requireActiveCompany();
  const preset = PRESETS[key];
  let added = 0;
  let skipped = 0;
  for (const h of preset.build(year)) {
    const inserted = await db
      .insert(schema.holidays)
      .values({ companyId: company.id, date: h.date, name: h.name, source: key, isActive: true })
      .onConflictDoNothing()
      .returning({ id: schema.holidays.id });
    if (inserted.length) added++;
    else skipped++;
  }
  await logAudit({ entityType: "company", entityId: company.id, action: "update", note: `Imported ${preset.label} ${year}: ${added} added, ${skipped} already present` });
  revalidatePath("/holidays");
  return { added, skipped };
}
