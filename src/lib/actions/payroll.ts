"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { logAudit } from "@/lib/audit";
import { requireActiveCompany } from "@/lib/company";
import { formValues, optStr, str, type FormState } from "@/lib/form";
import { toPaisa } from "@/lib/money";
import { computeMonth, ymBounds, type MonthKey } from "@/lib/payroll/generate";

const isMonth = (ym: string) => /^\d{4}-\d{2}$/.test(ym);

async function runFor(companyId: number, ym: MonthKey) {
  const { year, month } = ymBounds(ym);
  const [run] = await db
    .select()
    .from(schema.payrollRuns)
    .where(and(eq(schema.payrollRuns.companyId, companyId), eq(schema.payrollRuns.year, year), eq(schema.payrollRuns.month, month)))
    .limit(1);
  return run ?? null;
}

/**
 * Generate or regenerate the draft for a month. Regenerating deletes this run's
 * payslips and installment rows first, so it is idempotent (build-spec §8 #8).
 */
export async function generateDraft(ym: MonthKey): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!isMonth(ym)) return { ok: false, error: "Bad month" };
  const company = await requireActiveCompany();
  const existing = await runFor(company.id, ym);
  if (existing?.status === "locked") return { ok: false, error: "This month is locked — unlock it first" };

  const computed = await computeMonth(company, ym);
  if (computed.length === 0) return { ok: false, error: "No employees with a salary in this month" };

  const { year, month } = ymBounds(ym);
  await db.transaction(async (tx) => {
    let runId = existing?.id;
    if (runId) {
      await tx.delete(schema.advanceInstallments).where(eq(schema.advanceInstallments.payrollRunId, runId));
      await tx.delete(schema.payslips).where(eq(schema.payslips.payrollRunId, runId));
      await tx
        .update(schema.payrollRuns)
        .set({ divisorUsed: company.salaryDivisor, generatedAt: new Date().toISOString() })
        .where(eq(schema.payrollRuns.id, runId));
    } else {
      const [created] = await tx
        .insert(schema.payrollRuns)
        .values({ companyId: company.id, year, month, status: "draft", divisorUsed: company.salaryDivisor })
        .returning();
      runId = created.id;
    }

    for (const { employee, monthlySalary, result } of computed) {
      await tx.insert(schema.payslips).values({
        payrollRunId: runId,
        employeeId: employee.id,
        monthlySalary,
        perDayRate: result.perDayRate,
        divisor: company.salaryDivisor,
        presentDays: result.presentDays,
        weeklyOffDays: result.weeklyOffDays,
        publicHolidayDays: result.publicHolidayDays,
        leavePaidDays: result.leavePaidDays,
        leaveUnpaidDays: result.leaveUnpaidDays,
        absentDays: result.absentDays,
        payableDays: result.payableDays,
        unpaidDays: result.unpaidDays,
        baseAmount: result.baseAmount,
        deductionAmount: result.deductionAmount,
        advanceDeduction: result.advanceDeduction,
        otherAdditions: 0,
        otherDeductions: 0,
        netPayable: result.netPayable,
        wasOnProbation: result.wasOnProbation,
      });
      for (const split of result.advanceSplits) {
        await tx.insert(schema.advanceInstallments).values({
          advanceId: split.advanceId,
          payrollRunId: runId,
          month: ym,
          amount: split.amount,
        });
      }
    }
    await logAudit({
      entityType: "payroll_run",
      entityId: runId,
      action: existing ? "update" : "create",
      note: `${existing ? "Regenerated" : "Generated"} draft for ${ym} — ${computed.length} employees`,
    }, tx);
  });

  revalidatePath("/payroll");
  return { ok: true, count: computed.length };
}

/** Manual bonus / deduction on one draft payslip. Both need a note. */
export async function updateAdjustments(payslipId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const company = await requireActiveCompany();
  const [row] = await db
    .select({ payslip: schema.payslips, run: schema.payrollRuns })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .where(eq(schema.payslips.id, payslipId))
    .limit(1);
  if (!row || row.run.companyId !== company.id) return { error: "Payslip not found" };
  if (row.run.status === "locked") return { error: "Payroll is locked" };
  const values = formValues(fd);

  let additions = 0;
  let deductions = 0;
  try {
    additions = str(fd, "otherAdditions") === "" ? 0 : toPaisa(str(fd, "otherAdditions"));
    deductions = str(fd, "otherDeductions") === "" ? 0 : toPaisa(str(fd, "otherDeductions"));
  } catch {
    return { error: "Amounts must be numbers", values };
  }
  if (additions < 0 || deductions < 0) return { error: "Amounts cannot be negative", values };
  const additionsNote = optStr(fd, "otherAdditionsNote");
  const deductionsNote = optStr(fd, "otherDeductionsNote");
  if (additions > 0 && !additionsNote) return { error: "An addition needs a note", fieldErrors: { otherAdditionsNote: "Required" }, values };
  if (deductions > 0 && !deductionsNote) return { error: "A deduction needs a note", fieldErrors: { otherDeductionsNote: "Required" }, values };

  const p = row.payslip;
  const netPayable = p.baseAmount - p.deductionAmount - p.advanceDeduction + additions - deductions;
  const [after] = await db
    .update(schema.payslips)
    .set({
      otherAdditions: additions,
      otherAdditionsNote: additionsNote,
      otherDeductions: deductions,
      otherDeductionsNote: deductionsNote,
      netPayable,
    })
    .where(eq(schema.payslips.id, payslipId))
    .returning();
  await logAudit({ entityType: "payroll_run", entityId: row.run.id, action: "update", before: p, after, note: `Adjustment on payslip ${payslipId}` });

  revalidatePath("/payroll");
  return { ok: true };
}

/** Lock the month: snapshot stands, advance balances move. */
export async function lockRun(ym: MonthKey): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isMonth(ym)) return { ok: false, error: "Bad month" };
  const company = await requireActiveCompany();
  const run = await runFor(company.id, ym);
  if (!run) return { ok: false, error: "Generate a draft first" };
  if (run.status === "locked") return { ok: false, error: "Already locked" };

  await db.transaction(async (tx) => {
    const installments = await tx.select().from(schema.advanceInstallments).where(eq(schema.advanceInstallments.payrollRunId, run.id));
    for (const inst of installments) {
      const [advance] = await tx.select().from(schema.advances).where(eq(schema.advances.id, inst.advanceId)).limit(1);
      if (!advance) continue;
      const remaining = Math.max(0, advance.remainingAmount - inst.amount);
      await tx
        .update(schema.advances)
        .set({ remainingAmount: remaining, status: remaining === 0 ? "closed" : advance.status })
        .where(eq(schema.advances.id, advance.id));
      await logAudit({
        entityType: "advance",
        entityId: advance.id,
        action: "update",
        before: advance,
        note: `${ym} installment applied — remaining ${remaining / 100}`,
      }, tx);
    }
    await tx
      .update(schema.payrollRuns)
      .set({ status: "locked", lockedAt: new Date().toISOString() })
      .where(eq(schema.payrollRuns.id, run.id));
    await logAudit({ entityType: "payroll_run", entityId: run.id, action: "lock", note: `Locked ${ym}` }, tx);
  });

  revalidatePath("/payroll");
  return { ok: true };
}

/** Unlock: reverse the advance movement, reason is required and logged. */
export async function unlockRun(ym: MonthKey, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isMonth(ym)) return { ok: false, error: "Bad month" };
  if (!reason.trim()) return { ok: false, error: "A reason is required" };
  const company = await requireActiveCompany();
  const run = await runFor(company.id, ym);
  if (!run) return { ok: false, error: "No payroll for this month" };
  if (run.status !== "locked") return { ok: false, error: "Not locked" };

  await db.transaction(async (tx) => {
    const installments = await tx.select().from(schema.advanceInstallments).where(eq(schema.advanceInstallments.payrollRunId, run.id));
    for (const inst of installments) {
      const [advance] = await tx.select().from(schema.advances).where(eq(schema.advances.id, inst.advanceId)).limit(1);
      if (!advance) continue;
      const remaining = Math.min(advance.amount, advance.remainingAmount + inst.amount);
      await tx
        .update(schema.advances)
        .set({ remainingAmount: remaining, status: advance.status === "closed" && remaining > 0 ? "active" : advance.status })
        .where(eq(schema.advances.id, advance.id));
    }
    await tx
      .update(schema.payrollRuns)
      .set({ status: "draft", unlockedAt: new Date().toISOString(), unlockReason: reason.trim() })
      .where(eq(schema.payrollRuns.id, run.id));
    await logAudit({ entityType: "payroll_run", entityId: run.id, action: "unlock", note: `Unlocked ${ym} — ${reason.trim()}` }, tx);
  });

  revalidatePath("/payroll");
  return { ok: true };
}
