import { describe, expect, it } from "vitest";
import { instantOnShiftDate, to24h, validateManualTime, looseTimePreview } from "./time";

const co = { timezone: "Asia/Karachi", shiftStart: "20:00", shiftEnd: "05:00" };

describe("to24h", () => {
  it("converts", () => {
    expect(to24h("8:04", "PM")).toBe("20:04");
    expect(to24h("12:30", "AM")).toBe("00:30");
    expect(to24h("12:00", "PM")).toBe("12:00");
    expect(to24h("4:58", "AM")).toBe("04:58");
  });
  it("rejects garbage, but a 24-hour value is simply taken as-is", () => {
    expect(to24h("13:00", "PM")).toBe("13:00");
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

describe("parseLooseTime — phone keypads have no colon", () => {
  const cases: [string, "AM" | "PM", string][] = [
    ["8", "PM", "20:00"],
    ["8.00", "PM", "20:00"],
    ["8:00", "PM", "20:00"],
    ["8 00", "PM", "20:00"],
    ["8-00", "PM", "20:00"],
    ["8,04", "PM", "20:04"],
    ["800", "PM", "20:00"],
    ["0800", "PM", "20:00"],
    ["805", "PM", "20:05"],
    ["1230", "AM", "00:30"],
    ["12.30", "PM", "12:30"],
    ["4.58", "AM", "04:58"],
    ["458", "AM", "04:58"],
    ["12", "AM", "00:00"],
    ["12", "PM", "12:00"],
  ];
  for (const [input, ampm, expected] of cases) {
    it(`"${input}" ${ampm} → ${expected}`, () => {
      expect(to24h(input, ampm)).toBe(expected);
    });
  }

  it("a 24-hour value overrides the AM/PM picker", () => {
    expect(to24h("20:00", "AM")).toBe("20:00");
    expect(to24h("2000", "AM")).toBe("20:00");
    expect(to24h("0", "PM")).toBe("00:00");
    expect(to24h("13.15", "AM")).toBe("13:15");
  });

  it("am/pm typed into the box overrides the picker", () => {
    expect(to24h("8 pm", "AM")).toBe("20:00");
    expect(to24h("8.04am", "PM")).toBe("08:04");
    expect(to24h("8 p.m.", "AM")).toBe("20:00");
  });

  it("rejects what is not a time, with a readable reason", () => {
    expect(() => to24h("", "PM")).toThrow(/enter a time/i);
    expect(() => to24h("abc", "PM")).toThrow(/numbers only/i);
    expect(() => to24h("8.60", "PM")).toThrow(/minutes/i);
    expect(() => to24h("25.00", "PM")).toThrow(/hour/i);
    expect(() => to24h("12345", "PM")).toThrow(/look like a time/i);
  });

  it("looseTimePreview shows what will be saved, or nothing", () => {
    expect(looseTimePreview("8.04", "PM")).toBe("8:04 PM");
    expect(looseTimePreview("2000", "AM")).toBe("8:00 PM");
    expect(looseTimePreview("", "PM")).toBeNull();
    expect(looseTimePreview("x", "PM")).toBeNull();
  });
});
