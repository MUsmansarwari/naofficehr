import type { AttendanceStatus } from "@/db/schema";

export type DayInput = {
  date: string; // 'YYYY-MM-DD'
  weekday: number; // 0 = Sunday
  isHoliday: boolean;
  record?: { status: AttendanceStatus; isOverride: boolean } | null;
  joinDate: string;
  exitDate?: string | null;
};

export type ResolvedStatus = AttendanceStatus | "skip" | "future";

/**
 * Day-type precedence (build-spec §5):
 *   outside employment → skip
 *   manager override   → its status
 *   weekly off         → weekly_off      (before holiday: Sunday holiday stays an off day)
 *   public holiday     → public_holiday
 *   attendance record  → its status
 *   past, no record    → absent
 *   today/future       → future (not yet absent)
 */
export function resolveDay(d: DayInput, weeklyOffs: number[], today: string): ResolvedStatus {
  if (d.date < d.joinDate) return "skip";
  if (d.exitDate && d.date > d.exitDate) return "skip";
  if (d.record?.isOverride) return d.record.status;
  if (weeklyOffs.includes(d.weekday)) return "weekly_off";
  if (d.isHoliday) return "public_holiday";
  if (d.record) return d.record.status;
  return d.date < today ? "absent" : "future";
}
