import "server-only";
import { addMonths, format } from "date-fns";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Employee, SalaryStructure } from "@/db/schema";
import { parseYmd } from "@/lib/dates";

export function probationEnd(joinDate: string, months: number): string {
  return format(addMonths(parseYmd(joinDate), months), "yyyy-MM-dd");
}

/** Stage on a given day — probation until probation_end_date (exclusive). */
export function stageOn(e: Pick<Employee, "probationEndDate">, ymd: string) {
  return ymd < e.probationEndDate ? "probation" : "confirmed";
}

export async function listEmployees(
  companyId: number,
  opts: { status?: Employee["status"] | "all" } = {},
) {
  const status = opts.status ?? "active";
  const where =
    status === "all"
      ? eq(schema.employees.companyId, companyId)
      : and(eq(schema.employees.companyId, companyId), eq(schema.employees.status, status));
  const rows = await db.select().from(schema.employees).where(where).orderBy(asc(schema.employees.name));
  const salaries = await Promise.all(rows.map((r) => currentSalary(r.id)));
  return rows.map((r, i) => ({ ...r, salary: salaries[i] }));
}

export async function getEmployee(id: number) {
  const [row] = await db.select().from(schema.employees).where(eq(schema.employees.id, id)).limit(1);
  return row ?? null;
}

/** Latest salary row effective on or before `asOf` (today by default). */
export async function currentSalary(employeeId: number, asOf?: string): Promise<SalaryStructure | null> {
  const today = asOf ?? format(new Date(), "yyyy-MM-dd");
  const [row] = await db
    .select()
    .from(schema.salaryStructures)
    .where(
      and(eq(schema.salaryStructures.employeeId, employeeId), lte(schema.salaryStructures.effectiveFrom, today)),
    )
    .orderBy(desc(schema.salaryStructures.effectiveFrom))
    .limit(1);
  if (row) return row;
  // Future-dated only (e.g. joiner next month): show the earliest one.
  const [first] = await db
    .select()
    .from(schema.salaryStructures)
    .where(eq(schema.salaryStructures.employeeId, employeeId))
    .orderBy(asc(schema.salaryStructures.effectiveFrom))
    .limit(1);
  return first ?? null;
}

export async function salaryHistory(employeeId: number) {
  return db
    .select()
    .from(schema.salaryStructures)
    .where(eq(schema.salaryStructures.employeeId, employeeId))
    .orderBy(desc(schema.salaryStructures.effectiveFrom));
}

export async function employeeHistory(employeeId: number) {
  return db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entityType, "employee"), eq(schema.auditLog.entityId, employeeId)))
    .orderBy(desc(schema.auditLog.at))
    .limit(50);
}

/** True when the employee has no attendance, payslips or advances (hard-delete allowed, §9). */
export async function hasNoRecords(employeeId: number): Promise<boolean> {
  const [a] = await db.select({ id: schema.attendance.id }).from(schema.attendance).where(eq(schema.attendance.employeeId, employeeId)).limit(1);
  if (a) return false;
  const [p] = await db.select({ id: schema.payslips.id }).from(schema.payslips).where(eq(schema.payslips.employeeId, employeeId)).limit(1);
  if (p) return false;
  const [v] = await db.select({ id: schema.advances.id }).from(schema.advances).where(eq(schema.advances.employeeId, employeeId)).limit(1);
  return !v;
}
