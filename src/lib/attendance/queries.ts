import "server-only";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Attendance, Company } from "@/db/schema";
import { parseYmd, shiftDate } from "@/lib/dates";
import { stageOn } from "@/lib/employees";
import { resolveDay, type ResolvedStatus } from "./resolve";

export type GridDay = {
  date: string;
  weekday: number;
  isOff: boolean;
  holiday: string | null;
  isToday: boolean;
};

export type GridRecord = {
  status: Attendance["status"];
  isOverride: boolean;
  checkInAt: string | null;
  checkOutAt: string | null;
  byHand: boolean;
  note: string | null;
};

export type GridCell = {
  date: string;
  status: ResolvedStatus;
  record: GridRecord | null;
  missingCheckOut: boolean;
};

export type GridRow = {
  employee: { id: number; name: string; code: string; onProbation: boolean };
  cells: GridCell[];
  unpaid: number;
};

export async function getMonthGrid(company: Company, ym: string, now = new Date()) {
  const first = startOfMonth(parseYmd(`${ym}-01`));
  const last = endOfMonth(first);
  const from = format(first, "yyyy-MM-dd");
  const to = format(last, "yyyy-MM-dd");
  const today = shiftDate(now, company);

  const [employees, holidays] = await Promise.all([
    db
      .select()
      .from(schema.employees)
      .where(
        and(
          eq(schema.employees.companyId, company.id),
          inArray(schema.employees.status, ["active", "exited"]),
          lte(schema.employees.joinDate, to),
        ),
      )
      .orderBy(asc(schema.employees.name)),
    db
      .select()
      .from(schema.holidays)
      .where(
        and(
          eq(schema.holidays.companyId, company.id),
          eq(schema.holidays.isActive, true),
          gte(schema.holidays.date, from),
          lte(schema.holidays.date, to),
        ),
      ),
  ]);
  const inMonth = employees.filter((e) => !e.exitDate || e.exitDate >= from);

  const records = inMonth.length
    ? await db
        .select()
        .from(schema.attendance)
        .where(
          and(
            inArray(
              schema.attendance.employeeId,
              inMonth.map((e) => e.id),
            ),
            gte(schema.attendance.date, from),
            lte(schema.attendance.date, to),
          ),
        )
    : [];
  const byKey = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));

  const days: GridDay[] = eachDayOfInterval({ start: first, end: last }).map((d) => {
    const date = format(d, "yyyy-MM-dd");
    return {
      date,
      weekday: d.getDay(),
      isOff: company.weeklyOffs.includes(d.getDay()),
      holiday: holidayByDate.get(date) ?? null,
      isToday: date === today,
    };
  });

  const rows: GridRow[] = inMonth.map((e) => {
    let unpaid = 0;
    const cells = days.map((d): GridCell => {
      const r = byKey.get(`${e.id}|${d.date}`) ?? null;
      const status = resolveDay(
        {
          date: d.date,
          weekday: d.weekday,
          isHoliday: d.holiday !== null,
          record: r ? { status: r.status, isOverride: r.isOverride } : null,
          joinDate: e.joinDate,
          exitDate: e.exitDate,
        },
        company.weeklyOffs,
        today,
      );
      if (status === "absent" || status === "leave_unpaid") unpaid++;
      return {
        date: d.date,
        status,
        record: r
          ? {
              status: r.status,
              isOverride: r.isOverride,
              checkInAt: r.checkInAt,
              checkOutAt: r.checkOutAt,
              byHand: r.timeEnteredByHand,
              note: r.note,
            }
          : null,
        missingCheckOut: !!(r?.checkInAt && !r.checkOutAt && d.date < today),
      };
    });
    return {
      employee: { id: e.id, name: e.name, code: e.code, onProbation: stageOn(e, today) === "probation" },
      cells,
      unpaid,
    };
  });

  return { days, rows, today };
}
