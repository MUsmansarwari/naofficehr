import { format } from "date-fns";

type Preset = { date: string; name: string };

function ymd(y: number, m: number, d: number) {
  return format(new Date(y, m - 1, d), "yyyy-MM-dd");
}

/** nth weekday (0=Sun) of a month; n<0 counts from the end. */
function nthWeekday(y: number, m: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(y, m - 1, 1).getDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(y, m, 0).getDate();
  const last = new Date(y, m - 1, lastDay).getDay();
  return lastDay - ((last - weekday + 7) % 7) + (n + 1) * 7;
}

/** US rule: holiday on Saturday is observed Friday, on Sunday observed Monday. */
function observed(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (dow === 6) dt.setDate(d - 1);
  if (dow === 0) dt.setDate(d + 1);
  return format(dt, "yyyy-MM-dd");
}

export function usFederalHolidays(y: number): Preset[] {
  return [
    { date: observed(y, 1, 1), name: "New Year's Day" },
    { date: ymd(y, 1, nthWeekday(y, 1, 1, 3)), name: "Martin Luther King Jr. Day" },
    { date: ymd(y, 2, nthWeekday(y, 2, 1, 3)), name: "Presidents' Day" },
    { date: ymd(y, 5, nthWeekday(y, 5, 1, -1)), name: "Memorial Day" },
    { date: observed(y, 6, 19), name: "Juneteenth" },
    { date: observed(y, 7, 4), name: "Independence Day" },
    { date: ymd(y, 9, nthWeekday(y, 9, 1, 1)), name: "Labor Day" },
    { date: ymd(y, 10, nthWeekday(y, 10, 1, 2)), name: "Columbus Day" },
    { date: observed(y, 11, 11), name: "Veterans Day" },
    { date: ymd(y, 11, nthWeekday(y, 11, 4, 4)), name: "Thanksgiving Day" },
    { date: observed(y, 12, 25), name: "Christmas Day" },
  ];
}

/**
 * Pakistan gazetted holidays with fixed dates. Eid ul-Fitr, Eid ul-Adha, Ashura and
 * Eid Milad-un-Nabi follow the lunar calendar and are announced each year — add
 * them manually.
 */
export function pakistanHolidays(y: number): Preset[] {
  return [
    { date: ymd(y, 2, 5), name: "Kashmir Day" },
    { date: ymd(y, 3, 23), name: "Pakistan Day" },
    { date: ymd(y, 5, 1), name: "Labour Day" },
    { date: ymd(y, 8, 14), name: "Independence Day" },
    { date: ymd(y, 11, 9), name: "Iqbal Day" },
    { date: ymd(y, 12, 25), name: "Quaid-e-Azam Day" },
  ];
}

export const PRESETS = {
  us_federal: { label: "USA federal", build: usFederalHolidays },
  pakistan: { label: "Pakistan", build: pakistanHolidays },
} as const;
export type PresetKey = keyof typeof PRESETS;
