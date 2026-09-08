"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireActiveCompany } from "@/lib/company";
import { formValues, optStr, str, type FormState } from "@/lib/form";
import { toPaisa } from "@/lib/money";

/** Loads an advance and proves it belongs to the active company. */
async function owned(id: number) {
  const company = await requireActiveCompany();
  const [row] = await db
    .select({ advance: schema.advances, employee: schema.employees })
    .from(schema.advances)
    .innerJoin(schema.employees, eq(schema.advances.employeeId, schema.employees.id))
    .where(and(eq(schema.advances.id, id), eq(schema.employees.companyId, company.id)))
    .limit(1);
  return row ?? null;
}

export async function createAdvance(_prev: FormState, fd: FormData): Promise<FormState> {
  const company = await requireActiveCompany();
  const values = formValues(fd);
  const fail = (error: string, fieldErrors?: Record<string, string>) => ({ error, fieldErrors, values });

  const employeeId = Number(str(fd, "employeeId"));
  if (!employeeId) return fail("Pick an employee", { employeeId: "Required" });
  const [employee] = await db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, company.id)))
    .limit(1);
  if (!employee) return fail("Employee not found", { employeeId: "Required" });

  let amount: number;
  let installmentAmount: number;
  try {
    amount = toPaisa(str(fd, "amount"));
    installmentAmount = toPaisa(str(fd, "installmentAmount"));
  } catch {
    return fail("Amounts must be numbers");
  }
  if (amount <= 0) return fail("Enter the advance amount", { amount: "Required" });
  if (installmentAmount <= 0) return fail("Enter a monthly installment", { installmentAmount: "Required" });
  if (installmentAmount > amount) return fail("Installment cannot exceed the advance", { installmentAmount: "Too large" });

  const givenOn = str(fd, "givenOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(givenOn)) return fail("Pick the date it was given", { givenOn: "Required" });
  const startMonth = str(fd, "startMonth");
  if (!/^\d{4}-\d{2}$/.test(startMonth)) return fail("Pick the first deduction month", { startMonth: "Required" });

  const [row] = await db
    .insert(schema.advances)
    .values({
      employeeId,
      amount,
      reason: optStr(fd, "reason"),
      givenOn,
      installmentAmount,
      remainingAmount: amount,
      startMonth,
      status: "active",
      note: optStr(fd, "note"),
    })
    .returning();
  await logAudit({
    entityType: "advance",
    entityId: row.id,
    action: "create",
    after: row,
    note: `${employee.name}: Rs ${amount / 100} advance, Rs ${installmentAmount / 100}/month from ${startMonth}`,
  });

  revalidatePath("/advances");
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

/**
 * Only the installment, reason and note can change. The amount and the date it
 * was given are locked — a wrong one is closed and re-entered (build-spec §11).
 */
export async function updateAdvance(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const row = await owned(id);
  if (!row) return { error: "Advance not found", values };
  if (row.advance.status === "closed") return { error: "This advance is closed", values };

  let installmentAmount: number;
  try {
    installmentAmount = toPaisa(str(fd, "installmentAmount"));
  } catch {
    return { error: "Installment must be a number", values };
  }
  if (installmentAmount <= 0) return { error: "Enter a monthly installment", fieldErrors: { installmentAmount: "Required" }, values };

  const [after] = await db
    .update(schema.advances)
    .set({ installmentAmount, reason: optStr(fd, "reason"), note: optStr(fd, "note") })
    .where(eq(schema.advances.id, id))
    .returning();
  await logAudit({ entityType: "advance", entityId: id, action: "update", before: row.advance, after, note: "Advance edited" });

  revalidatePath("/advances");
  revalidatePath(`/employees/${row.advance.employeeId}`);
  return { ok: true };
}

/** Pause skips the advance in payroll; the balance does not move. */
export async function setAdvanceStatus(id: number, status: "active" | "paused") {
  const row = await owned(id);
  if (!row) return;
  if (row.advance.status === "closed" && row.advance.remainingAmount <= 0) return;
  const [after] = await db
    .update(schema.advances)
    .set({ status })
    .where(eq(schema.advances.id, id))
    .returning();
  await logAudit({ entityType: "advance", entityId: id, action: "update", before: row.advance, after, note: `Advance ${status}` });
  revalidatePath("/advances");
  revalidatePath(`/employees/${row.advance.employeeId}`);
}

/**
 * Close early / waive. What is still owed stays on the record so the history
 * shows exactly how much was written off — payroll simply stops taking it.
 */
export async function closeAdvance(id: number, reason: string) {
  const row = await owned(id);
  if (!row) return { ok: false as const, error: "Advance not found" };
  if (!reason.trim()) return { ok: false as const, error: "A reason is required" };
  const waived = row.advance.remainingAmount;
  const [after] = await db
    .update(schema.advances)
    .set({ status: "closed", note: reason.trim() })
    .where(eq(schema.advances.id, id))
    .returning();
  await logAudit({
    entityType: "advance",
    entityId: id,
    action: "update",
    before: row.advance,
    after,
    note: waived > 0 ? `Closed early — Rs ${waived / 100} waived: ${reason.trim()}` : `Closed: ${reason.trim()}`,
  });
  revalidatePath("/advances");
  revalidatePath(`/employees/${row.advance.employeeId}`);
  return { ok: true as const };
}

/** Undo a close made by mistake, while something is still owed. */
export async function reopenAdvance(id: number) {
  const row = await owned(id);
  if (!row || row.advance.status !== "closed" || row.advance.remainingAmount <= 0) return;
  const [after] = await db.update(schema.advances).set({ status: "active" }).where(eq(schema.advances.id, id)).returning();
  await logAudit({ entityType: "advance", entityId: id, action: "update", before: row.advance, after, note: "Advance reopened" });
  revalidatePath("/advances");
  revalidatePath(`/employees/${row.advance.employeeId}`);
}
