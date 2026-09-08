import "server-only";
import { addDays, format } from "date-fns";
import { and, asc, count, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Company } from "@/db/schema";
import { resolveDay } from "@/lib/attendance/resolve";
import { shiftDate } from "@/lib/dates";
import { ymBounds } from "@/lib/payroll/generate";

export type TonightRow = {
  id: number;
  name: string;
  code: string;
  onProbation: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  byHand: boolean;
  status: string;
};

const PROBATION_WINDOW_DAYS = 30;

export async function dashboardData(company: Company, now = new Date()) {
  const today = shiftDate(now, company);
  const ym = today.slice(0, 7);
  const { from, to, year, month } = ymBounds(ym);
  const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();

  const employees = await db
    .select()
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.companyId, company.id),
        eq(schema.employees.status, "active"),
        lte(schema.employees.joinDate, today),
      ),
    )
    .orderBy(asc(schema.employees.name));
  const ids = employees.map((e) => e.id);

  const [todayRows, holidayToday, monthRows, attempts, advances, runs] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(schema.attendance)
          .where(and(inArray(schema.attendance.employeeId, ids), eq(schema.attendance.date, today)))
      : [],
    db
      .select({ name: schema.holidays.name })
      .from(schema.holidays)
      .where(
        and(eq(schema.holidays.companyId, company.id), eq(schema.holidays.date, today), eq(schema.holidays.isActive, true)),
      )
      .limit(1),
    ids.length
      ? db
          .select()
          .from(schema.attendance)
          .where(and(inArray(schema.attendance.employeeId, ids), gte(schema.attendance.date, from), lte(schema.attendance.date, to)))
      : [],
    db
      .select({ n: count() })
      .from(schema.checkinAttempts)
      .where(
        and(
          eq(schema.checkinAttempts.companyId, company.id),
          eq(schema.checkinAttempts.success, false),
          gte(schema.checkinAttempts.at, new Date(now.getTime() - 24 * 3600_000).toISOString()),
        ),
      ),
    ids.length
      ? db
          .select()
          .from(schema.advances)
          .where(and(inArray(schema.advances.employeeId, ids), ne(schema.advances.status, "closed")))
      : [],
    db
      .select()
      .from(schema.payrollRuns)
      .where(and(eq(schema.payrollRuns.companyId, company.id), eq(schema.payrollRuns.year, year)))
      .orderBy(asc(schema.payrollRuns.month)),
  ]);

  const byEmployee = new Map(todayRows.map((r) => [r.employeeId, r]));
  const isWeeklyOff = company.weeklyOffs.includes(dayOfWeek);
  const isHoliday = holidayToday.length > 0;

  const tonight: TonightRow[] = employees.map((e) => {
    const record = byEmployee.get(e.id);
    const status = resolveDay(
      {
        date: today,
        weekday: dayOfWeek,
        isHoliday,
        record: record ? { status: record.status, isOverride: record.isOverride } : null,
        joinDate: e.joinDate,
        exitDate: e.exitDate,
      },
      company.weeklyOffs,
      today, // today itself is never "past", so an unmarked day stays open
    );
    return {
      id: e.id,
      name: e.name,
      code: e.code,
      onProbation: today < e.probationEndDate,
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
      byHand: record?.timeEnteredByHand ?? false,
      status,
    };
  });

  const working = isWeeklyOff || isHoliday ? [] : tonight;
  const checkedIn = tonight.filter((t) => t.checkInAt).length;
  const notYetIn = working.filter((t) => !t.checkInAt && t.status === "future").length;
  const offToday = tonight.filter((t) => t.status === "absent" || t.status === "leave_unpaid").length;

  const horizon = format(addDays(new Date(`${today}T12:00:00Z`), PROBATION_WINDOW_DAYS), "yyyy-MM-dd");
  const probationSoon = employees
    .filter((e) => e.probationEndDate >= today && e.probationEndDate <= horizon)
    .map((e) => ({
      id: e.id,
      name: e.name,
      endDate: e.probationEndDate,
      days: Math.round((Date.parse(`${e.probationEndDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
    }))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  return {
    today,
    ym,
    dayLabel: isHoliday ? holidayToday[0].name : isWeeklyOff ? "Weekly off" : null,
    counts: {
      active: employees.length,
      checkedIn,
      notYetIn,
      offToday,
      advancesOutstanding: advances.reduce((s, a) => s + a.remainingAmount, 0),
      advancePeople: new Set(advances.map((a) => a.employeeId)).size,
    },
    tonight,
    probationSoon,
    health: {
      failedPins: attempts[0]?.n ?? 0,
      byHand: monthRows.filter((r) => r.timeEnteredByHand).length,
      missingCheckOut: monthRows.filter((r) => r.checkInAt && !r.checkOutAt && r.date < today).length,
    },
    payroll: {
      thisMonth: runs.find((r) => r.month === month) ?? null,
      lastMonth: month > 1 ? (runs.find((r) => r.month === month - 1) ?? null) : null,
    },
  };
}
