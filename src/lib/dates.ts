import { addDays, format, parse } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export type YMD = string; // 'YYYY-MM-DD'

/** Hours after shift_end during which a timestamp still belongs to the previous shift date. */
export const SHIFT_END_BUFFER_HOURS = 3;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Shift date (build-spec §4). A shift that crosses midnight (end < start) keeps
 * the date it started on: Saturday 5:12 AM check-out → Friday.
 */
export function shiftDate(
  now: Date,
  company: { timezone: string; shiftStart: string; shiftEnd: string },
): YMD {
  const local = toZonedTime(now, company.timezone);
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  const start = minutesOf(company.shiftStart);
  const end = minutesOf(company.shiftEnd);
  const crossesMidnight = end < start;

  if (crossesMidnight && localMinutes < end + SHIFT_END_BUFFER_HOURS * 60) {
    return format(addDays(local, -1), "yyyy-MM-dd");
  }
  return format(local, "yyyy-MM-dd");
}

export function todayIn(timezone: string, now = new Date()): YMD {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

export function parseYmd(ymd: YMD): Date {
  return parse(ymd, "yyyy-MM-dd", new Date());
}

/** 'HH:mm' (24h, DB) → '8:04 PM' (display, build-spec §10: 12-hour everywhere). */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatLocal(iso: string | Date, timezone: string, pattern = "h:mm a"): string {
  return formatInTimeZone(iso, timezone, pattern);
}

export function longDate(ymd: YMD): string {
  return format(parseYmd(ymd), "EEEE, MMM d, yyyy");
}
