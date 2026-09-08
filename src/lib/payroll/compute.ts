// Payroll engine (build-spec §1). Pure — no DB, no dates library, no I/O.
// Money is integer paisa. Every amount that reaches a payslip is a whole number
// of rupees: divisions are rounded half-up to the rupee, in this file only.

export type PayDayType =
  | "present"
  | "weekly_off"
  | "public_holiday"
  | "leave_paid"
  | "leave_unpaid"
  | "absent";

/** One calendar day the employee was employed for. */
export type PayDay = {
  date: string;
  /** Day type resolved by build-spec §5, before the paid-leave quota is applied. */
  type: PayDayType;
  /** Monthly salary effective on this day, in paisa. */
  salaryPaisa: number;
  onProbation: boolean;
};

export type AdvanceInput = {
  id: number;
  installmentAmount: number;
  remainingAmount: number;
};

export type ComputeInput = {
  days: PayDay[];
  /** Company salary divisor — deductions are always salary ÷ divisor (default 30). */
  divisor: number;
  daysInMonth: number;
  /** Employed for every day of the month (no mid-month join or exit). */
  fullMonth: boolean;
  /** Salary effective on the last day of the month — the cap and the payslip headline. */
  monthlySalary: number;
  /** Paid leave left for the calendar year at the start of this month. */
  quotaRemaining: number;
  deductPublicHolidaysInProbation: boolean;
  /** Already filtered to active advances whose start month has arrived, oldest first. */
  advances?: AdvanceInput[];
  otherAdditions?: number;
  otherDeductions?: number;
};

export type ComputeResult = {
  presentDays: number;
  weeklyOffDays: number;
  publicHolidayDays: number;
  leavePaidDays: number;
  leaveUnpaidDays: number;
  absentDays: number;
  payableDays: number;
  unpaidDays: number;
  perDayRate: number;
  baseAmount: number;
  deductionAmount: number;
  advanceDeduction: number;
  advanceSplits: { advanceId: number; amount: number }[];
  otherAdditions: number;
  otherDeductions: number;
  netPayable: number;
  wasOnProbation: boolean;
  quotaUsed: number;
  quotaRemainingAfter: number;
};

/** Round a paisa amount to a whole rupee (half-up). */
function toRupee(paisa: number): number {
  return Math.round(paisa / 100) * 100;
}

export function computePayslip(input: ComputeInput): ComputeResult {
  const {
    days,
    divisor,
    daysInMonth,
    fullMonth,
    monthlySalary,
    deductPublicHolidaysInProbation,
  } = input;

  let quota = input.quotaRemaining;
  let quotaUsed = 0;
  let wasOnProbation = false;
  let unpaidDays = 0;
  let salarySum = 0;
  let unpaidSalarySum = 0;

  const counts: Record<PayDayType, number> = {
    present: 0,
    weekly_off: 0,
    public_holiday: 0,
    leave_paid: 0,
    leave_unpaid: 0,
    absent: 0,
  };

  // Per-day loop — probation can end and salary can change mid-month, so nothing
  // may be decided with a single month-level flag (build-spec §8 #4).
  for (const day of days) {
    if (day.onProbation) wasOnProbation = true;

    let type = day.type;
    if (type === "leave_paid") {
      // No paid leave during probation, and none once the annual quota is gone.
      if (day.onProbation || quota <= 0) {
        type = "leave_unpaid";
      } else {
        quota -= 1;
        quotaUsed += 1;
      }
    }
    counts[type] += 1;
    salarySum += day.salaryPaisa;

    const unpaid =
      type === "absent" ||
      type === "leave_unpaid" ||
      (type === "public_holiday" && day.onProbation && deductPublicHolidaysInProbation);
    if (unpaid) {
      unpaidDays += 1;
      unpaidSalarySum += day.salaryPaisa;
    }
  }

  // A full month earns the monthly salary whatever the month length; a partial
  // month accrues at salary ÷ divisor and can never exceed the monthly salary.
  const baseAmount = fullMonth
    ? Math.min(toRupee(salarySum / daysInMonth), monthlySalary)
    : Math.min(toRupee(salarySum / divisor), monthlySalary);
  const deductionAmount = toRupee(unpaidSalarySum / divisor);

  // Advances: oldest first, last installment is partial, salary never goes negative.
  const afterDeduction = baseAmount - deductionAmount;
  const advanceSplits: { advanceId: number; amount: number }[] = [];
  let advanceDeduction = 0;
  for (const a of input.advances ?? []) {
    const due = Math.min(a.installmentAmount, a.remainingAmount);
    const room = afterDeduction - advanceDeduction;
    const take = Math.max(0, Math.min(due, room));
    if (take > 0) {
      advanceSplits.push({ advanceId: a.id, amount: take });
      advanceDeduction += take;
    }
  }

  const otherAdditions = input.otherAdditions ?? 0;
  const otherDeductions = input.otherDeductions ?? 0;

  return {
    presentDays: counts.present,
    weeklyOffDays: counts.weekly_off,
    publicHolidayDays: counts.public_holiday,
    leavePaidDays: counts.leave_paid,
    leaveUnpaidDays: counts.leave_unpaid,
    absentDays: counts.absent,
    payableDays: days.length,
    unpaidDays,
    perDayRate: Math.round(monthlySalary / divisor),
    baseAmount,
    deductionAmount,
    advanceDeduction,
    advanceSplits,
    otherAdditions,
    otherDeductions,
    netPayable: baseAmount - deductionAmount - advanceDeduction + otherAdditions - otherDeductions,
    wasOnProbation,
    quotaUsed,
    quotaRemainingAfter: quota,
  };
}
