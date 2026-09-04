// Money is stored as integer paisa (build-spec §2). 100 paisa = 1 rupee.

export function toPaisa(rupees: number | string): number {
  const n = typeof rupees === "string" ? Number(String(rupees).replace(/[,\s]/g, "")) : rupees;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function toRupees(paisa: number): number {
  return paisa / 100;
}

/** 15000000 → "150,000" (no currency symbol; whole rupees, paisa dropped unless non-zero). */
export function fmtMoney(paisa: number): string {
  const rupees = paisa / 100;
  const hasPaisa = paisa % 100 !== 0;
  return rupees.toLocaleString("en-PK", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function fmtRs(paisa: number, currency = "PKR"): string {
  const sym = currency === "PKR" ? "Rs" : currency;
  return `${sym} ${fmtMoney(paisa)}`;
}
