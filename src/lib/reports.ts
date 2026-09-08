import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Company } from "@/db/schema";
import { getMonthGrid } from "@/lib/attendance/queries";
import { ymBounds } from "@/lib/payroll/generate";

export type RegisterRow = {
  code: string;
  name: string;
  designation: string | null;
  monthlySalary: number;
  payableDays: number;
  unpaidDays: number;
  baseAmount: number;
  deductionAmount: number;
  advanceDeduction: number;
  otherAdditions: number;
  otherDeductions: number;
  netPayable: number;
  bankName: string | null;
  accountNumber: string | null;
};

/** Salary register for a month — one row per payslip in that month's run. */
export async function salaryRegister(companyId: number, ym: string): Promise<RegisterRow[]> {
  const { year, month } = ymBounds(ym);
  const rows = await db
    .select({ p: schema.payslips, e: schema.employees })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .innerJoin(schema.employees, eq(schema.payslips.employeeId, schema.employees.id))
    .where(
      and(
        eq(schema.payrollRuns.companyId, companyId),
        eq(schema.payrollRuns.year, year),
        eq(schema.payrollRuns.month, month),
      ),
    )
    .orderBy(asc(schema.employees.name));

  return rows.map(({ p, e }) => ({
    code: e.code,
    name: e.name,
    designation: e.designation,
    monthlySalary: p.monthlySalary,
    payableDays: p.payableDays,
    unpaidDays: p.unpaidDays,
    baseAmount: p.baseAmount,
    deductionAmount: p.deductionAmount,
    advanceDeduction: p.advanceDeduction,
    otherAdditions: p.otherAdditions,
    otherDeductions: p.otherDeductions,
    netPayable: p.netPayable,
    bankName: e.bankName,
    accountNumber: e.accountNumber,
  }));
}

export type SummaryRow = {
  employeeId: number;
  code: string;
  name: string;
  present: number;
  weeklyOff: number;
  publicHoliday: number;
  leavePaid: number;
  leaveUnpaid: number;
  absent: number;
  /** Days still ahead of today — they become absent if nothing is marked. */
  notMarked: number;
  byHand: number;
  missingCheckOut: number;
};

/**
 * Attendance summary straight off the grid, so it always agrees with what the
 * manager sees there (build-spec §5 resolution, not the payroll snapshot).
 */
export async function attendanceSummary(company: Company, ym: string): Promise<SummaryRow[]> {
  const { rows } = await getMonthGrid(company, ym);
  return rows.map((r) => {
    const count = (s: string) => r.cells.filter((c) => c.status === s).length;
    return {
      employeeId: r.employee.id,
      code: r.employee.code,
      name: r.employee.name,
      present: count("present"),
      weeklyOff: count("weekly_off"),
      publicHoliday: count("public_holiday"),
      leavePaid: count("leave_paid"),
      leaveUnpaid: count("leave_unpaid"),
      absent: count("absent"),
      notMarked: count("future"),
      byHand: r.cells.filter((c) => c.record?.byHand).length,
      missingCheckOut: r.cells.filter((c) => c.missingCheckOut).length,
    };
  });
}

/** Paid leave taken this calendar year, up to and including `ym`. */
export async function paidLeaveThisYear(employeeId: number, ym: string): Promise<number> {
  const { year, month } = ymBounds(ym);
  const rows = await db
    .select({ days: schema.payslips.leavePaidDays })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .where(
      and(
        eq(schema.payslips.employeeId, employeeId),
        eq(schema.payrollRuns.year, year),
        lte(schema.payrollRuns.month, month),
      ),
    );
  return rows.reduce((sum, r) => sum + r.days, 0);
}

/** RFC 4180 quoting. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
