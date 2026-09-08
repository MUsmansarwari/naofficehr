import { describe, expect, it } from "vitest";
import { resolveDay } from "./resolve";

const base = { joinDate: "2026-01-01", exitDate: null, isHoliday: false };
const offs = [0, 6];
const today = "2026-09-20";

describe("resolveDay — precedence (build-spec §5)", () => {
  it("weekly off beats public holiday (Sunday holiday stays weekly_off)", () => {
    expect(resolveDay({ ...base, date: "2026-09-06", weekday: 0, isHoliday: true }, offs, today)).toBe("weekly_off");
  });
  it("holiday on a working day → public_holiday even if employee checked in", () => {
    expect(
      resolveDay({ ...base, date: "2026-09-07", weekday: 1, isHoliday: true, record: { status: "present", isOverride: false } }, offs, today),
    ).toBe("public_holiday");
  });
  it("manager override wins over everything", () => {
    expect(
      resolveDay({ ...base, date: "2026-09-06", weekday: 0, isHoliday: true, record: { status: "present", isOverride: true } }, offs, today),
    ).toBe("present");
  });
  it("record status used on normal day", () => {
    expect(resolveDay({ ...base, date: "2026-09-08", weekday: 2, record: { status: "leave_paid", isOverride: false } }, offs, today)).toBe("leave_paid");
  });
  it("past working day without record → absent", () => {
    expect(resolveDay({ ...base, date: "2026-09-08", weekday: 2 }, offs, today)).toBe("absent");
  });
  it("today and future without record → future, not absent", () => {
    expect(resolveDay({ ...base, date: "2026-09-20", weekday: 0 + 1, joinDate: "2026-01-01" }, [], today)).toBe("future");
    expect(resolveDay({ ...base, date: "2026-09-25", weekday: 5 }, offs, today)).toBe("future");
  });
  it("before join / after exit → skip", () => {
    expect(resolveDay({ ...base, date: "2026-09-08", weekday: 2, joinDate: "2026-09-16" }, offs, today)).toBe("skip");
    expect(resolveDay({ ...base, date: "2026-09-08", weekday: 2, exitDate: "2026-09-01" }, offs, today)).toBe("skip");
  });
});
