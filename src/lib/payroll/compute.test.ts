import { describe, expect, it } from "vitest";
import { computePayslip, type ComputeInput, type PayDay } from "./compute";

const RS = (rupees: number) => rupees * 100;

type BuildOpts = {
  daysInMonth?: number;
  salary: number; // rupees
  from?: number; // first day employed (default 1)
  to?: number; // last day employed (default daysInMonth)
  weeklyOffs?: number[]; // day-of-month numbers
  holidays?: number[];
  leavePaid?: number[];
  leaveUnpaid?: number[];
  absent?: number[];
  probationThrough?: number; // days 1..n are probation days
  salaryChange?: { fromDay: number; salary: number };
};

function buildDays(o: BuildOpts): PayDay[] {
  const n = o.daysInMonth ?? 30;
  const first = o.from ?? 1;
  const last = o.to ?? n;
  const days: PayDay[] = [];
  for (let d = first; d <= last; d++) {
    const salary = o.salaryChange && d >= o.salaryChange.fromDay ? o.salaryChange.salary : o.salary;
    // §5 precedence: weekly off wins over holiday, then explicit leave/absent.
    let type: PayDay["type"] = "present";
    if (o.weeklyOffs?.includes(d)) type = "weekly_off";
    else if (o.holidays?.includes(d)) type = "public_holiday";
    else if (o.leavePaid?.includes(d)) type = "leave_paid";
    else if (o.leaveUnpaid?.includes(d)) type = "leave_unpaid";
    else if (o.absent?.includes(d)) type = "absent";
    days.push({
      date: `2026-09-${String(d).padStart(2, "0")}`,
      type,
      salaryPaisa: RS(salary),
      onProbation: d <= (o.probationThrough ?? 0),
    });
  }
  return days;
}

function run(o: BuildOpts, extra: Partial<ComputeInput> = {}) {
  const daysInMonth = o.daysInMonth ?? 30;
  const days = buildDays(o);
  return computePayslip({
    days,
    divisor: 30,
    daysInMonth,
    fullMonth: (o.from ?? 1) === 1 && (o.to ?? daysInMonth) === daysInMonth,
    monthlySalary: RS(o.salaryChange?.salary ?? o.salary),
    quotaRemaining: 8,
    deductPublicHolidaysInProbation: false,
    ...extra,
  });
}

// Weekends in September 2026.
const SEPT_OFFS = [5, 6, 12, 13, 19, 20, 26, 27];

describe("basic month", () => {
  it("150k salary, 1 unpaid leave → 145,000", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leaveUnpaid: [3] });
    expect(r.baseAmount).toBe(RS(150_000));
    expect(r.deductionAmount).toBe(RS(5_000));
    expect(r.netPayable).toBe(RS(145_000));
    expect(r.unpaidDays).toBe(1);
    expect(r.weeklyOffDays).toBe(8);
    expect(r.presentDays).toBe(21);
  });

  it("31-day month, zero absence → full salary (not 103%)", () => {
    const r = run({ salary: 150_000, daysInMonth: 31 });
    expect(r.baseAmount).toBe(RS(150_000));
    expect(r.netPayable).toBe(RS(150_000));
    expect(r.payableDays).toBe(31);
  });

  it("28-day month, zero absence → full salary", () => {
    const r = run({ salary: 150_000, daysInMonth: 28 });
    expect(r.netPayable).toBe(RS(150_000));
  });

  it("weekly offs and public holidays are paid", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, holidays: [7] });
    expect(r.publicHolidayDays).toBe(1);
    expect(r.deductionAmount).toBe(0);
    expect(r.netPayable).toBe(RS(150_000));
  });

  it("absent days deduct at salary ÷ 30 regardless of month length", () => {
    const r = run({ salary: 80_000, daysInMonth: 31, absent: [3, 4] });
    expect(r.deductionAmount).toBe(RS(5_333)); // 2 × 2,666.67 → whole rupees
    expect(r.netPayable).toBe(RS(74_667));
  });
});

describe("probation", () => {
  it("no paid leave during probation — both leaves deduct, quota untouched", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leavePaid: [10, 21], probationThrough: 30 });
    expect(r.leavePaidDays).toBe(0);
    expect(r.leaveUnpaidDays).toBe(2);
    expect(r.quotaUsed).toBe(0);
    expect(r.quotaRemainingAfter).toBe(8);
    expect(r.deductionAmount).toBe(RS(10_000));
    expect(r.wasOnProbation).toBe(true);
  });

  it("probation ends on the 15th: leave on the 10th unpaid, on the 21st paid", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leavePaid: [10, 21], probationThrough: 14 });
    expect(r.leaveUnpaidDays).toBe(1);
    expect(r.leavePaidDays).toBe(1);
    expect(r.quotaUsed).toBe(1);
    expect(r.deductionAmount).toBe(RS(5_000));
    expect(r.netPayable).toBe(RS(145_000));
    expect(r.wasOnProbation).toBe(true);
  });

  it("public holiday in probation — toggle off, nothing deducted", () => {
    const r = run(
      { salary: 150_000, weeklyOffs: SEPT_OFFS, holidays: [7], probationThrough: 30 },
      { deductPublicHolidaysInProbation: false },
    );
    expect(r.deductionAmount).toBe(0);
    expect(r.netPayable).toBe(RS(150_000));
  });

  it("public holiday in probation — toggle on, one day deducted", () => {
    const r = run(
      { salary: 150_000, weeklyOffs: SEPT_OFFS, holidays: [7], probationThrough: 30 },
      { deductPublicHolidaysInProbation: true },
    );
    expect(r.unpaidDays).toBe(1);
    expect(r.deductionAmount).toBe(RS(5_000));
    expect(r.netPayable).toBe(RS(145_000));
  });

  it("a holiday falling on a weekly off is a weekly off — never deducted in probation", () => {
    // §5 resolves weekly_off before public_holiday, so day 6 arrives typed as weekly_off.
    const r = run(
      { salary: 150_000, weeklyOffs: SEPT_OFFS, holidays: [6], probationThrough: 30 },
      { deductPublicHolidaysInProbation: true },
    );
    expect(r.publicHolidayDays).toBe(0);
    expect(r.weeklyOffDays).toBe(8);
    expect(r.deductionAmount).toBe(0);
  });

  it("a confirmed employee is never flagged as on probation", () => {
    expect(run({ salary: 150_000 }).wasOnProbation).toBe(false);
  });
});

describe("paid leave quota", () => {
  it("quota 8, 10 leaves → 8 paid, 2 deducted", () => {
    const leaves = [1, 2, 3, 4, 7, 8, 9, 10, 11, 14];
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leavePaid: leaves });
    expect(r.leavePaidDays).toBe(8);
    expect(r.leaveUnpaidDays).toBe(2);
    expect(r.quotaRemainingAfter).toBe(0);
    expect(r.deductionAmount).toBe(RS(10_000));
    expect(r.netPayable).toBe(RS(140_000));
  });

  it("quota already spent earlier in the year → every leave is unpaid", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leavePaid: [8, 9] }, { quotaRemaining: 0 });
    expect(r.leavePaidDays).toBe(0);
    expect(r.leaveUnpaidDays).toBe(2);
  });

  it("consumes chronologically — the earlier leave is the paid one", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, leavePaid: [8, 22] }, { quotaRemaining: 1 });
    expect(r.leavePaidDays).toBe(1);
    expect(r.quotaRemainingAfter).toBe(0);
    // the 22nd is the one that falls through to unpaid
    expect(r.leaveUnpaidDays).toBe(1);
  });
});

describe("mid-month joiner and leaver", () => {
  it("joined on the 16th, 90k salary → 15 days = 45,000", () => {
    const r = run({ salary: 90_000, from: 16, weeklyOffs: SEPT_OFFS });
    expect(r.payableDays).toBe(15);
    expect(r.baseAmount).toBe(RS(45_000));
    expect(r.netPayable).toBe(RS(45_000));
  });

  it("31 payable days at salary ÷ 30 is capped at the monthly salary", () => {
    const r = computePayslip({
      days: buildDays({ salary: 150_000, daysInMonth: 31 }),
      divisor: 30,
      daysInMonth: 31,
      fullMonth: false, // pro-rated path: 31 × 5,000 = 155,000 before the cap
      monthlySalary: RS(150_000),
      quotaRemaining: 8,
      deductPublicHolidaysInProbation: false,
    });
    expect(r.baseAmount).toBe(RS(150_000));
  });

  it("exits on the 20th → 20 days, days after the exit are not payable", () => {
    const r = run({ salary: 150_000, to: 20, weeklyOffs: SEPT_OFFS });
    expect(r.payableDays).toBe(20);
    expect(r.baseAmount).toBe(RS(100_000));
  });

  it("pro-rated month still deducts unpaid days", () => {
    const r = run({ salary: 90_000, from: 16, weeklyOffs: SEPT_OFFS, absent: [17] });
    expect(r.baseAmount).toBe(RS(45_000));
    expect(r.deductionAmount).toBe(RS(3_000));
    expect(r.netPayable).toBe(RS(42_000));
  });
});

describe("mid-month salary change", () => {
  it("135k until the 15th, 150k from the 16th → 142,500", () => {
    const r = run({ salary: 135_000, salaryChange: { fromDay: 16, salary: 150_000 }, weeklyOffs: SEPT_OFFS });
    expect(r.baseAmount).toBe(RS(142_500));
    expect(r.netPayable).toBe(RS(142_500));
  });

  it("an unpaid day is deducted at the rate in force that day", () => {
    const r = run({
      salary: 135_000,
      salaryChange: { fromDay: 16, salary: 150_000 },
      weeklyOffs: SEPT_OFFS,
      absent: [10], // old rate: 135,000 ÷ 30 = 4,500
    });
    expect(r.deductionAmount).toBe(RS(4_500));
    expect(r.netPayable).toBe(RS(138_000));
  });
});

describe("advances", () => {
  const advance = (over: Partial<{ id: number; installmentAmount: number; remainingAmount: number }> = {}) => ({
    id: 1,
    installmentAmount: RS(10_000),
    remainingAmount: RS(30_000),
    ...over,
  });

  it("deducts one installment", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS }, { advances: [advance()] });
    expect(r.advanceDeduction).toBe(RS(10_000));
    expect(r.advanceSplits).toEqual([{ advanceId: 1, amount: RS(10_000) }]);
    expect(r.netPayable).toBe(RS(140_000));
  });

  it("last installment is partial — remaining 3,000 with a 10,000 installment takes 3,000", () => {
    const r = run(
      { salary: 150_000, weeklyOffs: SEPT_OFFS },
      { advances: [advance({ remainingAmount: RS(3_000) })] },
    );
    expect(r.advanceDeduction).toBe(RS(3_000));
    expect(r.netPayable).toBe(RS(147_000));
  });

  it("installment larger than the salary clamps at zero, never negative", () => {
    const r = run(
      { salary: 10_000, weeklyOffs: SEPT_OFFS },
      { advances: [advance({ installmentAmount: RS(25_000), remainingAmount: RS(25_000) })] },
    );
    expect(r.advanceDeduction).toBe(RS(10_000));
    expect(r.netPayable).toBe(0);
  });

  it("two advances: the older one is paid first, the newer is clamped", () => {
    const r = run(
      { salary: 20_000, weeklyOffs: SEPT_OFFS },
      {
        advances: [
          advance({ id: 1, installmentAmount: RS(15_000), remainingAmount: RS(15_000) }),
          advance({ id: 2, installmentAmount: RS(15_000), remainingAmount: RS(15_000) }),
        ],
      },
    );
    expect(r.advanceSplits).toEqual([
      { advanceId: 1, amount: RS(15_000) },
      { advanceId: 2, amount: RS(5_000) },
    ]);
    expect(r.netPayable).toBe(0);
  });

  it("advances come out of salary after deductions", () => {
    const r = run({ salary: 150_000, weeklyOffs: SEPT_OFFS, absent: [3, 4] }, { advances: [advance()] });
    expect(r.deductionAmount).toBe(RS(10_000));
    expect(r.advanceDeduction).toBe(RS(10_000));
    expect(r.netPayable).toBe(RS(130_000));
  });
});

describe("manual adjustments", () => {
  it("additions and deductions apply after everything else", () => {
    const r = run(
      { salary: 150_000, weeklyOffs: SEPT_OFFS, absent: [3] },
      { otherAdditions: RS(10_000), otherDeductions: RS(2_000) },
    );
    expect(r.netPayable).toBe(RS(153_000));
  });
});
