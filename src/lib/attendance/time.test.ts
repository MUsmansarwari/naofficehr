import { describe, expect, it } from "vitest";
import { instantOnShiftDate, to24h, validateManualTime } from "./time";

const co = { timezone: "Asia/Karachi", shiftStart: "20:00", shiftEnd: "05:00" };

describe("to24h", () => {
  it("converts", () => {
    expect(to24h("8:04", "PM")).toBe("20:04");
    expect(to24h("12:30", "AM")).toBe("00:30");
    expect(to24h("12:00", "PM")).toBe("12:00");
    expect(to24h("4:58", "AM")).toBe("04:58");
  });
  it("rejects garbage", () => {
    expect(() => to24h("13:00", "PM")).toThrow();
    expect(() => to24h("abc", "AM")).toThrow();
  });
});

describe("instantOnShiftDate", () => {
  it("evening time stays on the shift date", () => {
    expect(instantOnShiftDate("2026-09-04", "20:04", co).toISOString()).toBe("2026-09-04T15:04:00.000Z");
  });
  it("early-morning time rolls to the next calendar day", () => {
    expect(instantOnShiftDate("2026-09-04", "04:58", co).toISOString()).toBe("2026-09-04T23:58:00.000Z");
  });
  it("day shift never rolls", () => {
    const day = { timezone: "Asia/Karachi", shiftStart: "09:00", shiftEnd: "17:00" };
    expect(instantOnShiftDate("2026-09-04", "04:00", day).toISOString()).toBe("2026-09-03T23:00:00.000Z");
  });
});

describe("validateManualTime", () => {
  const now = new Date("2026-09-05T02:00:00Z"); // Sat 7:00 AM Karachi
  it("accepts 4:58 AM check-out after 8:04 PM check-in", () => {
    const checkInAt = instantOnShiftDate("2026-09-04", "20:04", co);
    const at = instantOnShiftDate("2026-09-04", "04:58", co);
    expect(validateManualTime({ kind: "out", at, shiftDate: "2026-09-04", company: co, now, checkInAt })).toBeNull();
  });
  it("rejects check-out before check-in", () => {
    const checkInAt = instantOnShiftDate("2026-09-04", "21:00", co);
    const at = instantOnShiftDate("2026-09-04", "20:30", co);
    expect(validateManualTime({ kind: "out", at, shiftDate: "2026-09-04", company: co, now, checkInAt })).toMatch(/after check-in/);
  });
  it("rejects future", () => {
    const at = instantOnShiftDate("2026-09-04", "07:30", co); // Sat 7:30 AM > now 7:00 AM
    expect(validateManualTime({ kind: "out", at, shiftDate: "2026-09-04", company: co, now })).toMatch(/future/);
  });
  it("rejects outside window (noon)", () => {
    const at = instantOnShiftDate("2026-09-04", "12:00", co);
    const later = new Date("2026-09-05T10:00:00Z");
    expect(validateManualTime({ kind: "in", at, shiftDate: "2026-09-04", company: co, now: later })).toMatch(/within/);
  });
});
