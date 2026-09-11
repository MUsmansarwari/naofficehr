import { addDays, format, parse } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { SHIFT_END_BUFFER_HOURS, type YMD } from "@/lib/dates";

type ShiftCompany = { timezone: string; shiftStart: string; shiftEnd: string };

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Reads a time the way a person types it on a phone keypad — there is no colon
 * on most numeric keyboards, so every reasonable shape is accepted:
 *   "8" "8.00" "8:00" "8 00" "800" "0800" "8-00" "8,00"  → 8:00
 *   "1230" "12.30" → 12:30    "805" → 8:05    "20:00" → 8 PM (24h wins over the picker)
 * Returns the hour (1–12), minutes and the resolved AM/PM, or throws.
 */
export function parseLooseTime(input: string, ampm: "AM" | "PM"): { hour: number; minute: number; ampm: "AM" | "PM" } {
  let s = input.trim().toLowerCase();
  if (s === "") throw new Error("Enter a time");

  // An am/pm typed into the box overrides the picker.
  const suffix = /\s*([ap])\.?\s*m?\.?\s*$/.exec(s);
  if (suffix && /[ap]/.test(suffix[1])) {
    ampm = suffix[1] === "a" ? "AM" : "PM";
    s = s.slice(0, suffix.index);
  }

  const digits = s.replace(/[^\d]/g, "");
  if (digits === "" || !/^[\d\s.:,\-]+$/.test(s)) throw new Error("Use numbers only, like 8.04 or 804");

  let hour: number;
  let minute: number;
  const sep = /^(\d{1,2})[\s.:,\-]+(\d{1,2})$/.exec(s);
  if (sep) {
    hour = Number(sep[1]);
    minute = Number(sep[2]);
  } else if (digits.length <= 2) {
    hour = Number(digits);
    minute = 0;
  } else if (digits.length === 3) {
    hour = Number(digits[0]);
    minute = Number(digits.slice(1));
  } else if (digits.length === 4) {
    hour = Number(digits.slice(0, 2));
    minute = Number(digits.slice(2));
  } else {
    throw new Error("That does not look like a time");
  }

  if (minute > 59) throw new Error("Minutes must be 00–59");
  if (hour > 23) throw new Error("Hour must be 0–23");
  if (hour === 0) {
    hour = 12;
    ampm = "AM";
  } else if (hour > 12) {
    hour -= 12;
    ampm = "PM";
  }
  return { hour, minute, ampm };
}

/** What a typed value will be saved as — shown live under the input. */
export function looseTimePreview(input: string, ampm: "AM" | "PM"): string | null {
  try {
    const t = parseLooseTime(input, ampm);
    return `${t.hour}:${String(t.minute).padStart(2, "0")} ${t.ampm}`;
  } catch {
    return null;
  }
}

/** Anything parseLooseTime accepts + 'AM'/'PM' → '04:58' (24h). Throws with a readable message. */
export function to24h(hourMinute: string, ampm: "AM" | "PM"): string {
  const t = parseLooseTime(hourMinute, ampm);
  let h = t.hour;
  if (t.ampm === "AM" && h === 12) h = 0;
  if (t.ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
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
