import { describe, expect, it } from "vitest";
import { addMonthsYm, installmentSchedule, monthLabel, nextMonth } from "./schedule";

const RS = (r: number) => r * 100;

describe("nextMonth", () => {
  it("rolls over the year", () => {
    expect(nextMonth("2026-09")).toBe("2026-10");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(addMonthsYm("2026-11", 3)).toBe("2027-02");
  });
});

describe("installmentSchedule", () => {
  it("splits evenly when the installment divides the amount", () => {
    const s = installmentSchedule({ remaining: RS(50_000), installment: RS(10_000), startMonth: "2026-07" });
    expect(s).toHaveLength(5);
    expect(s[0]).toEqual({ month: "2026-07", amount: RS(10_000) });
    expect(s[4]).toEqual({ month: "2026-11", amount: RS(10_000) });
  });

  it("last installment is the remainder", () => {
    const s = installmentSchedule({ remaining: RS(25_000), installment: RS(10_000), startMonth: "2026-07" });
    expect(s.map((r) => r.amount)).toEqual([RS(10_000), RS(10_000), RS(5_000)]);
  });

  it("one installment when it covers everything", () => {
    const s = installmentSchedule({ remaining: RS(3_000), installment: RS(10_000), startMonth: "2026-07" });
    expect(s).toEqual([{ month: "2026-07", amount: RS(3_000) }]);
  });

  it("nothing to schedule when settled or misconfigured", () => {
    expect(installmentSchedule({ remaining: 0, installment: RS(10_000), startMonth: "2026-07" })).toEqual([]);
    expect(installmentSchedule({ remaining: RS(10_000), installment: 0, startMonth: "2026-07" })).toEqual([]);
  });

  it("stops at the row cap instead of running forever", () => {
    const s = installmentSchedule({ remaining: RS(100_000), installment: RS(1), startMonth: "2026-01" });
    expect(s).toHaveLength(60);
  });
});

describe("monthLabel", () => {
  it("formats a month key", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
    expect(monthLabel("2027-01")).toBe("Jan 2027");
  });
});
