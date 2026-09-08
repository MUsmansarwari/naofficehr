import { addDays, format, parse } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { SHIFT_END_BUFFER_HOURS, type YMD } from "@/lib/dates";

type ShiftCompany = { timezone: string; shiftStart: string; shiftEnd: string };

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** '4:58' + 'AM' → '04:58' (24h). Throws on garbage. */
export function to24h(hourMinute: string, ampm: "AM" | "PM"): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hourMinute.trim());
  if (!m) throw new Error("Time must be h:mm");
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) throw new Error("Invalid time");
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * A wall-clock time typed for a given SHIFT date → UTC instant.
 * For a midnight-crossing shift, times before shift_end + buffer belong to the
 * next calendar day (Friday's shift, 4:58 AM → Saturday 04:58 local).
 */
export function instantOnShiftDate(shiftDate: YMD, hhmm24: string, company: ShiftCompany): Date {
  const crosses = minutes(company.shiftEnd) < minutes(company.shiftStart);
  let day = parse(shiftDate, "yyyy-MM-dd", new Date());
  if (crosses && minutes(hhmm24) < minutes(company.shiftEnd) + SHIFT_END_BUFFER_HOURS * 60) {
    day = addDays(day, 1);
  }
  return fromZonedTime(`${format(day, "yyyy-MM-dd")}T${hhmm24}:00`, company.timezone);
}

/**
 * Manual time rules (build-spec §4): inside the shift window
 * (start − 2h … end + 3h), check-out after check-in, never in the future.
 * Returns an error message or null.
 */
export function validateManualTime(input: {
  kind: "in" | "out";
  at: Date;
  shiftDate: YMD;
  company: ShiftCompany;
  now: Date;
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
}): string | null {
  const { kind, at, shiftDate, company, now } = input;
  if (at.getTime() > now.getTime()) return "That time is in the future";

  const windowStart = instantOnShiftDate(shiftDate, company.shiftStart, company).getTime() - 2 * 3600_000;
  const windowEnd = instantOnShiftDate(shiftDate, company.shiftEnd, company).getTime() + SHIFT_END_BUFFER_HOURS * 3600_000;
  if (at.getTime() < windowStart || at.getTime() > windowEnd) return "Time must be within tonight's shift";

  if (kind === "out" && input.checkInAt && at.getTime() <= input.checkInAt.getTime()) return "Check-out must be after check-in";
  if (kind === "in" && input.checkOutAt && at.getTime() >= input.checkOutAt.getTime()) return "Check-in must be before check-out";
  return null;
}
