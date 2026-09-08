// Installment projection (build-spec §11). Pure — money is integer paisa.

export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function addMonthsYm(ym: string, n: number): string {
  let out = ym;
  for (let i = 0; i < n; i++) out = nextMonth(out);
  return out;
}

/**
 * Months this advance will be taken in, given what is still owed.
 * The last one is whatever is left, so it can be smaller than the installment.
 */
export function installmentSchedule(input: {
  remaining: number;
  installment: number;
  startMonth: string;
  /** Safety net against a fat-fingered tiny installment. */
  maxRows?: number;
}): { month: string; amount: number }[] {
  const { remaining, installment, startMonth } = input;
  const max = input.maxRows ?? 60;
  if (remaining <= 0 || installment <= 0) return [];

  const rows: { month: string; amount: number }[] = [];
  let left = remaining;
  let month = startMonth;
  while (left > 0 && rows.length < max) {
    const amount = Math.min(installment, left);
    rows.push({ month, amount });
    left -= amount;
    month = nextMonth(month);
  }
  return rows;
}

/** 'YYYY-MM' → 'Sep 2026'. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${y}`;
}
