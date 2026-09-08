"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireActiveCompany } from "@/lib/company";
import { todayIn } from "@/lib/dates";
import { hasNoRecords, probationEnd, stageOn } from "@/lib/employees";
import { formValues, fromZod, optStr, str, type FormState } from "@/lib/form";
import { toPaisa } from "@/lib/money";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const employeeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(2, "Name is required"),
  phone: z.string().nullable(),
  email: z.string().email("Invalid email").nullable(),
  cnic: z.string().nullable(),
  designation: z.string().nullable(),
  joinDate: ymd,
  probationMonths: z.coerce.number().int().min(0).max(12),
  probationEndDate: ymd.nullable(),
  leaveQuotaAnnual: z.coerce.number().int().min(0).max(60).nullable(),
  checkinPin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits").nullable(),
  bankName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  notes: z.string().nullable(),
});

function parseEmployee(fd: FormData) {
  const num = (k: string) => (str(fd, k) === "" ? null : str(fd, k));
  return employeeSchema.safeParse({
    code: str(fd, "code"),
    name: str(fd, "name"),
    phone: optStr(fd, "phone"),
    email: optStr(fd, "email"),
    cnic: optStr(fd, "cnic"),
    designation: optStr(fd, "designation"),
    joinDate: str(fd, "joinDate"),
    probationMonths: str(fd, "probationMonths"),
    probationEndDate: optStr(fd, "probationEndDate"),
    leaveQuotaAnnual: num("leaveQuotaAnnual"),
    checkinPin: optStr(fd, "checkinPin"),
    bankName: optStr(fd, "bankName"),
    accountNumber: optStr(fd, "accountNumber"),
    notes: optStr(fd, "notes"),
  });
}

function uniqueError(e: unknown, fd: FormData): FormState | null {
  const msg = String(e);
  if (!msg.includes("UNIQUE")) return null;
  const values = formValues(fd);
  if (msg.includes("pin")) return { error: "PIN already used", fieldErrors: { checkinPin: "Another employee has this PIN" }, values };
  if (msg.includes("code")) return { error: "Code already used", fieldErrors: { code: "Another employee has this code" }, values };
  return { error: "Duplicate value", values };
}

export async function createEmployee(_prev: FormState, fd: FormData): Promise<FormState> {
  const company = await requireActiveCompany();
  const parsed = parseEmployee(fd);
  if (!parsed.success) return fromZod(parsed.error, fd);
  const salaryRaw = str(fd, "monthlySalary");
  let monthlySalary: number;
  try {
    monthlySalary = toPaisa(salaryRaw);
    if (monthlySalary <= 0) throw new Error();
  } catch {
    return { error: "Salary is required", fieldErrors: { monthlySalary: "Enter the monthly salary" }, values: formValues(fd) };
  }

  const d = parsed.data;
  const probationEndDate = d.probationEndDate ?? probationEnd(d.joinDate, d.probationMonths);
  const today = todayIn(company.timezone);
  let id: number;
  try {
    id = await db.transaction(async (tx) => {
      const [emp] = await tx
        .insert(schema.employees)
        .values({
          companyId: company.id,
          ...d,
          probationEndDate,
          employmentStage: stageOn({ probationEndDate }, today),
        })
        .returning();
      await tx.insert(schema.salaryStructures).values({
        employeeId: emp.id,
        monthlySalary,
        effectiveFrom: d.joinDate,
        note: "Initial salary",
      });
      return emp.id;
    });
  } catch (e) {
    const u = uniqueError(e, fd);
    if (u) return u;
    throw e;
  }
  await logAudit({ entityType: "employee", entityId: id, action: "create", after: { ...d, monthlySalary } });
  revalidatePath("/employees");
  redirect(`/employees/${id}`);
}

export async function updateEmployee(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const company = await requireActiveCompany();
  const parsed = parseEmployee(fd);
  if (!parsed.success) return fromZod(parsed.error, fd);
  const [before] = await db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.id, id), eq(schema.employees.companyId, company.id)));
  if (!before) return { error: "Employee not found", values: formValues(fd) };

  const d = parsed.data;
  const probationEndDate = d.probationEndDate ?? probationEnd(d.joinDate, d.probationMonths);
  const today = todayIn(company.timezone);
  try {
    const [after] = await db
      .update(schema.employees)
      .set({
        ...d,
        probationEndDate,
        employmentStage: stageOn({ probationEndDate }, today),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.employees.id, id))
      .returning();
    await logAudit({ entityType: "employee", entityId: id, action: "update", before, after });
  } catch (e) {
    const u = uniqueError(e, fd);
    if (u) return u;
    throw e;
  }
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  return { ok: true };
}

export async function changeSalary(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const effectiveFrom = str(fd, "effectiveFrom");
  const note = optStr(fd, "note");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: "Pick an effective date", fieldErrors: { effectiveFrom: "Required" }, values: formValues(fd) };
  let monthlySalary: number;
  try {
    monthlySalary = toPaisa(str(fd, "monthlySalary"));
    if (monthlySalary <= 0) throw new Error();
  } catch {
    return { error: "Enter a salary", fieldErrors: { monthlySalary: "Enter the monthly salary" }, values: formValues(fd) };
  }
  try {
    const [row] = await db
      .insert(schema.salaryStructures)
      .values({ employeeId: id, monthlySalary, effectiveFrom, note })
      .returning();
    await logAudit({ entityType: "salary_structure", entityId: row.id, action: "create", after: row, note });
    await logAudit({ entityType: "employee", entityId: id, action: "update", after: { monthlySalary, effectiveFrom }, note: `Salary changed${note ? ` — ${note}` : ""}` });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { error: "A salary row already exists for that date", fieldErrors: { effectiveFrom: "Already has a row" }, values: formValues(fd) };
    throw e;
  }
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
  return { ok: true };
}

export async function setEmployeeStatus(id: number, status: "active" | "archived") {
  const [before] = await db.select().from(schema.employees).where(eq(schema.employees.id, id));
  if (!before) return;
  // Archive is for exited employees (§9); un-archive restores exited, not active.
  const next = status === "archived" ? "archived" : before.exitDate ? "exited" : "active";
  const [after] = await db
    .update(schema.employees)
    .set({ status: next, updatedAt: new Date().toISOString() })
    .where(eq(schema.employees.id, id))
    .returning();
  await logAudit({ entityType: "employee", entityId: id, action: "update", before, after, note: `Status → ${next}` });
  revalidatePath(`/employees/${id}`);
  revalidatePath("/employees");
}

/** Hard delete — only when the employee has zero records (enforced here, not just in UI). */
export async function deleteEmployeePermanently(id: number) {
  if (!(await hasNoRecords(id))) throw new Error("Employee has records and cannot be deleted");
  const [before] = await db.select().from(schema.employees).where(eq(schema.employees.id, id));
  if (!before) return;
  await db.transaction(async (tx) => {
    await tx.delete(schema.salaryStructures).where(eq(schema.salaryStructures.employeeId, id));
    await tx.delete(schema.employees).where(eq(schema.employees.id, id));
  });
  await logAudit({ entityType: "employee", entityId: id, action: "delete", before });
  revalidatePath("/employees");
  redirect("/employees");
}
