import "server-only";
import { addDays, eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { and, asc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Company, Employee } from "@/db/schema";
import { resolveDay } from "@/lib/attendance/resolve";
import { parseYmd } from "@/lib/dates";
import { computePayslip, type ComputeResult, type PayDay } from "./compute";

export type MonthKey = string; // 'YYYY-MM'

export type EmployeePayroll = {
  employee: Employee;
  monthlySalary: number;
  result: ComputeResult;
};

function ymBounds(ym: MonthKey) {
  const first = startOfMonth(parseYmd(`${ym}-01`));
  const last = endOfMonth(first);
  return {
    first,
    last,
    from: format(first, "yyyy-MM-dd"),
    to: format(last, "yyyy-MM-dd"),
    daysInMonth: last.getDate(),
    year: first.getFullYear(),
    month: first.getMonth() + 1,
  };
}

/**
 * Paid leave already used this calendar year before `ym`.
 * Locked months are frozen at their payslip snapshot; unlocked months are
 * recomputed from attendance, chronologically, until the quota runs out
 * (build-spec §1 — "locked month freeze").
 */
async function quotaUsedBefore(employee: Employee, ym: MonthKey, quota: number): Promise<number> {
  const { year, from } = ymBounds(ym);
  const yearStart = `${year}-01-01`;

  const locked = await db
    .select({ month: schema.payrollRuns.month, leavePaidDays: schema.payslips.leavePaidDays })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .where(
      and(
        eq(schema.payslips.employeeId, employee.id),
        eq(schema.payrollRuns.status, "locked"),
        eq(schema.payrollRuns.year, year),
        lt(schema.payrollRuns.month, ymBounds(ym).month),
      ),
    );
  const lockedMonths = new Set(locked.map((l) => `${year}-${String(l.month).padStart(2, "0")}`));
  let used = locked.reduce((sum, l) => sum + l.leavePaidDays, 0);

  const rows = await db
    .select({ date: schema.attendance.date })
    .from(schema.attendance)
    .where(
      and(
        eq(schema.attendance.employeeId, employee.id),
        eq(schema.attendance.status, "leave_paid"),
        gte(schema.attendance.date, yearStart),
        lt(schema.attendance.date, from),
      ),
    )
    .orderBy(asc(schema.attendance.date));

  for (const r of rows) {
    if (lockedMonths.has(r.date.slice(0, 7))) continue; // already counted, frozen
    if (r.date < employee.probationEndDate) continue; // probation leave never touches the quota
    if (used >= quota) break;
    used += 1;
  }
  return used;
}

/** Employees who were on the payroll for at least one day of the month. */
export async function payrollEmployees(companyId: number, ym: MonthKey): Promise<Employee[]> {
  const { from, to } = ymBounds(ym);
  const rows = await db
    .select()
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.companyId, companyId),
        inArray(schema.employees.status, ["active", "exited"]),
        lte(schema.employees.joinDate, to),
      ),
    )
    .orderBy(asc(schema.employees.name));
  return rows.filter((e) => !e.exitDate || e.exitDate >= from);
}

/**
 * Run the engine for every employee in the month. Reads only — the caller
 * decides what to persist.
 */
export async function computeMonth(company: Company, ym: MonthKey): Promise<EmployeePayroll[]> {
  const { from, to, last, daysInMonth } = ymBounds(ym);
  const employees = await payrollEmployees(company.id, ym);
  if (employees.length === 0) return [];
  const ids = employees.map((e) => e.id);

  const [holidayRows, attendanceRows, salaryRows, advanceRows] = await Promise.all([
    db
      .select({ date: schema.holidays.date })
      .from(schema.holidays)
      .where(
        and(
          eq(schema.holidays.companyId, company.id),
          eq(schema.holidays.isActive, true),
          gte(schema.holidays.date, from),
          lte(schema.holidays.date, to),
        ),
      ),
    db
      .select()
      .from(schema.attendance)
      .where(and(inArray(schema.attendance.employeeId, ids), gte(schema.attendance.date, from), lte(schema.attendance.date, to))),
    db
      .select()
      .from(schema.salaryStructures)
      .where(inArray(schema.salaryStructures.employeeId, ids))
      .orderBy(asc(schema.salaryStructures.effectiveFrom)),
    db
      .select()
      .from(schema.advances)
      .where(and(inArray(schema.advances.employeeId, ids), eq(schema.advances.status, "active"), lte(schema.advances.startMonth, ym)))
      .orderBy(asc(schema.advances.givenOn), asc(schema.advances.id)),
  ]);

  const holidays = new Set(holidayRows.map((h) => h.date));
  const attendance = new Map(attendanceRows.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const salaries = new Map<number, typeof salaryRows>();
  for (const s of salaryRows) salaries.set(s.employeeId, [...(salaries.get(s.employeeId) ?? []), s]);

  // Days with no attendance record count as absent, so resolve against the day
  // after the month ends — generating early marks the rest of the month absent.
  const resolveAgainst = format(addDays(last, 1), "yyyy-MM-dd");
  const calendar = eachDayOfInterval({ start: startOfMonth(last), end: last });

  const out: EmployeePayroll[] = [];
  for (const employee of employees) {
    const history = salaries.get(employee.id) ?? [];
    if (history.length === 0) continue; // no salary on file — nothing to pay
    const salaryOn = (date: string) => {
      let picked = history[0]; // future-dated only: fall back to the earliest
      for (const s of history) if (s.effectiveFrom <= date) picked = s;
      return picked.monthlySalary;
    };

    const days: PayDay[] = [];
    for (const d of calendar) {
      const date = format(d, "yyyy-MM-dd");
      const record = attendance.get(`${employee.id}|${date}`);
      const status = resolveDay(
        {
          date,
          weekday: d.getDay(),
          isHoliday: holidays.has(date),
          record: record ? { status: record.status, isOverride: record.isOverride } : null,
          joinDate: employee.joinDate,
          exitDate: employee.exitDate,
        },
        company.weeklyOffs,
        resolveAgainst,
      );
      if (status === "skip" || status === "future") continue;
      days.push({
        date,
        type: status,
        salaryPaisa: salaryOn(date),
        onProbation: date < employee.probationEndDate,
      });
    }
    if (days.length === 0) continue;

    const quota = employee.leaveQuotaAnnual ?? company.defaultLeaveQuota;
    const used = await quotaUsedBefore(employee, ym, quota);
    const monthlySalary = salaryOn(to);

    const result = computePayslip({
      days,
      divisor: company.salaryDivisor,
      daysInMonth,
      fullMonth: employee.joinDate <= from && (!employee.exitDate || employee.exitDate >= to),
      monthlySalary,
      quotaRemaining: Math.max(0, quota - used),
      deductPublicHolidaysInProbation: company.deductPublicHolidaysInProbation,
      advances: advanceRows
        .filter((a) => a.employeeId === employee.id && a.remainingAmount > 0)
        .map((a) => ({ id: a.id, installmentAmount: a.installmentAmount, remainingAmount: a.remainingAmount })),
    });

    out.push({ employee, monthlySalary, result });
  }
  return out;
}

export type RunView = Awaited<ReturnType<typeof getRun>>;

/** The saved run for a month, with its payslips joined to employees. */
export async function getRun(companyId: number, ym: MonthKey) {
  const { year, month } = ymBounds(ym);
  const [run] = await db
    .select()
    .from(schema.payrollRuns)
    .where(and(eq(schema.payrollRuns.companyId, companyId), eq(schema.payrollRuns.year, year), eq(schema.payrollRuns.month, month)))
    .limit(1);
  if (!run) return null;

  const rows = await db
    .select({ payslip: schema.payslips, employee: schema.employees })
    .from(schema.payslips)
    .innerJoin(schema.employees, eq(schema.payslips.employeeId, schema.employees.id))
    .where(eq(schema.payslips.payrollRunId, run.id))
    .orderBy(asc(schema.employees.name));

  return { run, rows };
}

/** Flags worth reviewing before locking (build-spec §3 screen 8). */
export async function monthWarnings(companyId: number, ym: MonthKey) {
  const { from, to } = ymBounds(ym);
  const ids = (await payrollEmployees(companyId, ym)).map((e) => e.id);
  if (ids.length === 0) return { byHand: 0, missingCheckOut: 0 };
  const rows = await db
    .select()
    .from(schema.attendance)
    .where(and(inArray(schema.attendance.employeeId, ids), gte(schema.attendance.date, from), lte(schema.attendance.date, to)));
  return {
    byHand: rows.filter((r) => r.timeEnteredByHand).length,
    missingCheckOut: rows.filter((r) => r.checkInAt && !r.checkOutAt).length,
  };
}

export { ymBounds };

