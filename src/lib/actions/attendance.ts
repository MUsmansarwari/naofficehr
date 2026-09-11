"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { attendanceStatuses } from "@/db/schema";
import { instantOnShiftDate, to24h } from "@/lib/attendance/time";
import { logAudit } from "@/lib/audit";
import { requireActiveCompany } from "@/lib/company";

const editSchema = z.object({
  employeeId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** null = clear the manager override / delete an empty record */
  status: z.enum(attendanceStatuses).nullable(),
  /** 'h:mm AM' strings; undefined = leave as is, '' = clear */
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  note: z.string().optional(),
});
export type AttendanceEdit = z.infer<typeof editSchema>;

function parseTime(v: string | undefined, shiftDate: string, company: { timezone: string; shiftStart: string; shiftEnd: string }) {
  if (v === undefined) return undefined;
  if (v.trim() === "") return null;
  // Accepts "8:04 PM", "8.04pm", "804 PM" — same lenient rules as the check-in page.
  const m = /^(.*?)\s*(am|pm)$/i.exec(v.trim());
  const ampm = (m ? m[2].toUpperCase() : "AM") as "AM" | "PM";
  const body = m ? m[1] : v.trim();
  try {
    return instantOnShiftDate(shiftDate, to24h(body, ampm), company).toISOString();
  } catch (err) {
    throw new Error(`Time "${v}": ${err instanceof Error ? err.message : "invalid"} — try 8:04 PM`);
  }
}

/** Batch save from the grid (build-spec §8 #5: one call, not one per cell). */
export async function saveAttendance(edits: AttendanceEdit[]): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const company = await requireActiveCompany();
  const parsed = z.array(editSchema).max(2000).safeParse(edits);
  if (!parsed.success) return { ok: false, error: "Invalid edits" };

  const empIds = [...new Set(parsed.data.map((e) => e.employeeId))];
  const owned = new Set(
    (
      await db
        .select({ id: schema.employees.id })
        .from(schema.employees)
        .where(eq(schema.employees.companyId, company.id))
    ).map((r) => r.id),
  );
  if (empIds.some((id) => !owned.has(id))) return { ok: false, error: "Employee not in this company" };

  let saved = 0;
  try {
    await db.transaction(async (tx) => {
      const nowIso = new Date().toISOString();
      for (const e of parsed.data) {
        const [existing] = await tx
          .select()
          .from(schema.attendance)
          .where(and(eq(schema.attendance.employeeId, e.employeeId), eq(schema.attendance.date, e.date)))
          .limit(1);

        const checkInAt = parseTime(e.checkIn, e.date, company);
        const checkOutAt = parseTime(e.checkOut, e.date, company);
        const finalIn = checkInAt === undefined ? (existing?.checkInAt ?? null) : checkInAt;
        const finalOut = checkOutAt === undefined ? (existing?.checkOutAt ?? null) : checkOutAt;
        if (finalIn && finalOut && finalOut <= finalIn) throw new Error(`${e.date}: check-out must be after check-in`);

        if (e.status === null) {
          // Clear override: keep times if any (auto-resolves to present), else delete the row.
          if (!existing) continue;
          if (finalIn || finalOut) {
            await tx
              .update(schema.attendance)
              .set({ status: "present", isOverride: false, checkInAt: finalIn, checkOutAt: finalOut, note: e.note ?? existing.note, updatedAt: nowIso })
              .where(eq(schema.attendance.id, existing.id));
          } else {
            await tx.delete(schema.attendance).where(eq(schema.attendance.id, existing.id));
          }
          await logAudit({ entityType: "attendance", entityId: existing.id, action: "delete", before: existing, note: "Override cleared" }, tx);
          saved++;
          continue;
        }

        if (existing) {
          const [after] = await tx
            .update(schema.attendance)
            .set({
              status: e.status,
              isOverride: true,
              checkInAt: finalIn,
              checkOutAt: finalOut,
              note: e.note ?? existing.note,
              updatedAt: nowIso,
            })
            .where(eq(schema.attendance.id, existing.id))
            .returning();
          await logAudit({ entityType: "attendance", entityId: existing.id, action: "override", before: existing, after, note: e.note }, tx);
        } else {
          const [after] = await tx
            .insert(schema.attendance)
            .values({
              employeeId: e.employeeId,
              date: e.date,
              status: e.status,
              source: "manual",
              isOverride: true,
              checkInAt: finalIn,
              checkOutAt: finalOut,
              note: e.note ?? null,
              updatedAt: nowIso,
            })
            .returning();
          await logAudit({ entityType: "attendance", entityId: after.id, action: "override", after, note: e.note }, tx);
        }
        saved++;
      }
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
  revalidatePath("/attendance");
  return { ok: true, saved };
}
