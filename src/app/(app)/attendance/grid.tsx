"use client";

import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useMemo, useState, useTransition } from "react";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/skeleton";
import type { AttendanceStatus } from "@/db/schema";
import { saveAttendance, type AttendanceEdit } from "@/lib/actions/attendance";
import type { GridCell, GridDay, GridRow } from "@/lib/attendance/queries";
import type { ResolvedStatus } from "@/lib/attendance/resolve";
import { cn } from "@/lib/utils";
import { CellDialog, type CellDraft } from "./cell-dialog";

export const STATUS_META: Record<AttendanceStatus, { label: string; short: string; cell: string; swatch: string }> = {
  present: { label: "Present", short: "P", cell: "bg-white text-navy", swatch: "bg-white" },
  weekly_off: { label: "Weekly off", short: "", cell: "bg-chalk text-navy-45", swatch: "bg-chalk" },
  public_holiday: { label: "Public holiday", short: "H", cell: "bg-sand text-navy-70", swatch: "bg-sand" },
  leave_paid: { label: "Paid leave", short: "L", cell: "bg-navy-12 text-navy", swatch: "bg-navy-12" },
  leave_unpaid: { label: "Unpaid leave", short: "L", cell: "bg-red-12 text-red", swatch: "bg-red-12" },
  absent: { label: "Absent", short: "A", cell: "bg-red text-white", swatch: "bg-red" },
};

type Props = { company: { timezone: string }; days: GridDay[]; rows: GridRow[]; today: string };
type Edits = Record<string, AttendanceEdit>;
const keyOf = (employeeId: number, date: string) => `${employeeId}|${date}`;

export function AttendanceGrid({ company, days, rows, today }: Props) {
  const [edits, setEdits] = useState<Edits>({});
  const [open, setOpen] = useState<{ row: GridRow; cell: GridCell } | null>(null);
  const [paint, setPaint] = useState<AttendanceStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editCount = Object.keys(edits).length;

  const effective = (row: GridRow, cell: GridCell): ResolvedStatus => {
    const e = edits[keyOf(row.employee.id, cell.date)];
    if (!e) return cell.status;
    if (e.status) return e.status;
    // cleared override → what the day would resolve to without a manual status
    if (cell.record?.isOverride) {
      const d = days.find((x) => x.date === cell.date)!;
      if (d.isOff) return "weekly_off";
      if (d.holiday) return "public_holiday";
      if (cell.record.checkInAt) return "present";
      return cell.date < today ? "absent" : "future";
    }
    return cell.status;
  };

  const setEdit = (row: GridRow, cell: GridCell, patch: Partial<AttendanceEdit>) =>
    setEdits((prev) => {
      const k = keyOf(row.employee.id, cell.date);
      const base: AttendanceEdit = prev[k] ?? { employeeId: row.employee.id, date: cell.date, status: cell.record?.status ?? null };
      return { ...prev, [k]: { ...base, ...patch } };
    });

  const paintCell = (row: GridRow, cell: GridCell) => {
    if (!paint || cell.status === "skip") return;
    setEdit(row, cell, { status: paint });
  };
  /**
   * Bulk mark never turns a weekly off or a holiday into a working day by
   * accident — those only change when that is the colour being painted.
   */
  const bulkPaintable = (cell: GridCell) => {
    if (cell.status === "skip" || cell.status === "future") return false;
    const isOffDay = cell.status === "weekly_off" || cell.status === "public_holiday";
    return !isOffDay || paint === "weekly_off" || paint === "public_holiday";
  };
  const paintRow = (row: GridRow) => row.cells.forEach((c) => bulkPaintable(c) && setEdit(row, c, { status: paint! }));
  const paintColumn = (date: string) =>
    rows.forEach((r) => {
      const c = r.cells.find((x) => x.date === date)!;
      if (bulkPaintable(c)) setEdit(r, c, { status: paint! });
    });

  const unpaidFor = (row: GridRow) => row.cells.filter((c) => ["absent", "leave_unpaid"].includes(effective(row, c))).length;

  const save = () =>
    start(async () => {
      const r = await saveAttendance(Object.values(edits));
      if (r.ok) {
        setEdits({});
        setMsg(`Saved ${r.saved} change${r.saved === 1 ? "" : "s"}`);
      } else setMsg(r.error);
    });

  const legend = useMemo(() => (Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => [s, STATUS_META[s]] as const), []);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-navy-70">
        {legend.map(([s, m]) => (
          <button
            key={s}
            type="button"
            onClick={() => setPaint(paint === s ? null : s)}
            className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5", paint === s && "bg-navy text-chalk")}
            title="Click to bulk-mark: then click cells, a name (whole row) or a date (whole column)"
          >
            <i className={cn("inline-block h-3.5 w-[18px] rounded border border-navy-06", m.swatch)} />
            {m.label}
          </button>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-1.5 rounded-full bg-amber" /> time typed by hand
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-0 border-b-8 border-l-8 border-b-navy-45 border-l-transparent" /> no check-out
        </span>
        <span className="ml-auto flex items-center gap-2">
          {paint && (
            <span className="text-navy">
              Bulk mark: <b>{STATUS_META[paint].label}</b> — click cells, a name or a date.{" "}
              <button type="button" className="underline" onClick={() => setPaint(null)}>
                Done
              </button>
            </span>
          )}
          {msg && !editCount && <span>{msg}</span>}
          {editCount > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEdits({})}>
                Discard
              </Button>
              <Button size="sm" disabled={pending} onClick={save}>
                {pending && <Spinner />}
                {pending ? "Saving…" : `Save changes · ${editCount}`}
              </Button>
            </>
          )}
        </span>
      </div>

      <div className="overflow-auto rounded-2xl bg-white shadow-card">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-navy-06 bg-white px-4 py-2 text-left font-medium text-navy-45">Employee</th>
              {days.map((d) => (
                <th
                  key={d.date}
                  onClick={() => paint && paintColumn(d.date)}
                  title={d.holiday ?? undefined}
                  className={cn(
                    "sticky top-0 z-10 h-11 w-[34px] border-b border-r border-navy-06 bg-white text-center text-[11px] font-normal text-navy-45",
                    d.isOff && "bg-chalk",
                    d.holiday && !d.isOff && "bg-sand",
                    paint && "cursor-pointer hover:bg-navy-12",
                  )}
                >
                  {"SMTWTFS"[d.weekday]}
                  <b className={cn("block text-[13px] font-semibold text-navy", d.isToday && "text-amber")}>{Number(d.date.slice(8))}</b>
                </th>
              ))}
              <th className="sticky right-0 z-20 min-w-[72px] border-b border-l border-navy-06 bg-white px-2 text-center font-medium text-navy-45">Unpaid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="px-4 py-8 text-center text-sm text-navy-45">
                  No employees in this month.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const unpaid = unpaidFor(row);
              return (
                <tr key={row.employee.id}>
                  <td
                    onClick={() => paint && paintRow(row)}
                    className={cn("sticky left-0 z-10 border-b border-r border-soft bg-white px-4 py-1.5 text-sm font-medium", paint && "cursor-pointer hover:bg-navy-12")}
                  >
                    {row.employee.name}
                    {row.employee.onProbation && (
                      <Tag variant="probation" className="ml-1.5">
                        Probation
                      </Tag>
                    )}
                    <span className="block text-[11px] font-normal text-navy-45">{row.employee.code}</span>
                  </td>
                  {row.cells.map((cell) => {
                    const s = effective(row, cell);
                    const edited = !!edits[keyOf(row.employee.id, cell.date)];
                    const meta = s === "skip" || s === "future" ? null : STATUS_META[s];
                    return (
                      <td
                        key={cell.date}
                        onClick={() => {
                          if (s === "skip") return;
                          if (paint) paintCell(row, cell);
                          else setOpen({ row, cell });
                        }}
                        className={cn(
                          "relative h-10 w-[34px] border-b border-r border-navy-06 text-center font-medium",
                          meta?.cell,
                          s === "future" && "bg-white",
                          s === "skip" && "bg-chalk/60",
                          s !== "skip" && "cursor-pointer hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-navy",
                          edited && "outline outline-2 -outline-offset-2 outline-amber",
                        )}
                      >
                        {meta?.short}
                        {cell.record?.byHand && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber" />}
                        {cell.missingCheckOut && <span className="absolute bottom-0 right-0 size-0 border-b-[7px] border-l-[7px] border-b-navy/50 border-l-transparent" />}
                      </td>
                    );
                  })}
                  <td className={cn("sticky right-0 z-10 border-b border-l border-soft bg-white text-center", unpaid > 0 ? "font-semibold text-red" : "text-navy-45")}>
                    {unpaid}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <CellDialog
          key={keyOf(open.row.employee.id, open.cell.date)}
          employeeName={open.row.employee.name}
          date={open.cell.date}
          dateLabel={format(new Date(open.cell.date + "T00:00:00"), "EEE, MMM d")}
          current={effective(open.row, open.cell)}
          draft={toDraft(open.cell, edits[keyOf(open.row.employee.id, open.cell.date)], company.timezone)}
          onClose={() => setOpen(null)}
          onApply={(d) => {
            setEdit(open.row, open.cell, { status: d.status, checkIn: d.checkIn, checkOut: d.checkOut, note: d.note });
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

function toDraft(cell: GridCell, edit: AttendanceEdit | undefined, tz: string): CellDraft {
  const fmt = (iso: string | null) => (iso ? formatInTimeZone(iso, tz, "h:mm a") : "");
  return {
    status: edit ? edit.status : (cell.record?.isOverride ? cell.record.status : null),
    checkIn: edit?.checkIn ?? fmt(cell.record?.checkInAt ?? null),
    checkOut: edit?.checkOut ?? fmt(cell.record?.checkOutAt ?? null),
    note: edit?.note ?? cell.record?.note ?? "",
    source: cell.record ? (cell.record.isOverride ? "override" : "check-in") : "none",
  };
}
