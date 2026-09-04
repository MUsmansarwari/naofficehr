import { describe, expect, it } from "vitest";
import { shiftDate, to12h } from "./dates";

// Karachi is UTC+5, no DST. Office hours 8:00 PM – 5:00 AM (crosses midnight).
const co = { timezone: "Asia/Karachi", shiftStart: "20:00", shiftEnd: "05:00" };
const karachi = (ymdHm: string) => new Date(`${ymdHm}:00+05:00`);

describe("shiftDate — midnight-crossing shift (build-spec §4)", () => {
  it("Friday 8:04 PM check-in → Friday", () => {
    expect(shiftDate(karachi("2026-09-04T20:04"), co)).toBe("2026-09-04");
  });
  it("Saturday 5:12 AM check-out → Friday (same record)", () => {
    expect(shiftDate(karachi("2026-09-05T05:12"), co)).toBe("2026-09-04");
  });
  it("Saturday 4:55 AM manual entry → Friday", () => {
    expect(shiftDate(karachi("2026-09-05T04:55"), co)).toBe("2026-09-04");
  });
  it("Saturday 7:59 AM (inside 3h buffer) → Friday", () => {
    expect(shiftDate(karachi("2026-09-05T07:59"), co)).toBe("2026-09-04");
  });
  it("Saturday 8:00 AM (buffer over) → Saturday", () => {
    expect(shiftDate(karachi("2026-09-05T08:00"), co)).toBe("2026-09-05");
  });
  it("Friday 7:00 PM early arrival → Friday", () => {
    expect(shiftDate(karachi("2026-09-04T19:00"), co)).toBe("2026-09-04");
  });
  it("uses company timezone, not server: 1 AM UTC Sat = 6 AM Karachi Sat → Friday", () => {
    expect(shiftDate(new Date("2026-09-05T01:00:00Z"), co)).toBe("2026-09-04");
  });
  it("month boundary: Oct 1 3:00 AM → Sept 30", () => {
    expect(shiftDate(karachi("2026-10-01T03:00"), co)).toBe("2026-09-30");
  });
});

describe("shiftDate — normal day shift", () => {
  const day = { timezone: "Asia/Karachi", shiftStart: "09:00", shiftEnd: "17:00" };
  it("never shifts backwards", () => {
    expect(shiftDate(karachi("2026-09-05T01:00"), day)).toBe("2026-09-05");
    expect(shiftDate(karachi("2026-09-05T09:00"), day)).toBe("2026-09-05");
    expect(shiftDate(karachi("2026-09-05T23:59"), day)).toBe("2026-09-05");
  });
});

describe("to12h", () => {
  it("formats 24h strings", () => {
    expect(to12h("20:04")).toBe("8:04 PM");
    expect(to12h("05:00")).toBe("5:00 AM");
    expect(to12h("00:30")).toBe("12:30 AM");
    expect(to12h("12:00")).toBe("12:00 PM");
  });
});
