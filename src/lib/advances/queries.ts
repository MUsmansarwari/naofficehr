import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Advance, Employee } from "@/db/schema";

export type InstallmentRow = {
  id: number;
  month: string;
  amount: number;
  /** Draft installments are projected only — they move money when the run locks. */
  locked: boolean;
};

export type AdvanceView = {
  advance: Advance;
  employee: Employee;
  taken: number;
  installments: InstallmentRow[];
};

async function attach(rows: { advance: Advance; employee: Employee }[]): Promise<AdvanceView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.advance.id);
  const installments = await db
    .select({
      id: schema.advanceInstallments.id,
      advanceId: schema.advanceInstallments.advanceId,
      month: schema.advanceInstallments.month,
      amount: schema.advanceInstallments.amount,
      status: schema.payrollRuns.status,
    })
    .from(schema.advanceInstallments)
    .innerJoin(schema.payrollRuns, eq(schema.advanceInstallments.payrollRunId, schema.payrollRuns.id))
    .where(inArray(schema.advanceInstallments.advanceId, ids))
    .orderBy(asc(schema.advanceInstallments.month));

  return rows.map(({ advance, employee }) => {
    const mine = installments
      .filter((i) => i.advanceId === advance.id)
      .map((i) => ({ id: i.id, month: i.month, amount: i.amount, locked: i.status === "locked" }));
    return {
      advance,
      employee,
      taken: advance.amount - advance.remainingAmount,
      installments: mine,
    };
  });
}

export async function listAdvances(companyId: number): Promise<AdvanceView[]> {
  const rows = await db
    .select({ advance: schema.advances, employee: schema.employees })
    .from(schema.advances)
    .innerJoin(schema.employees, eq(schema.advances.employeeId, schema.employees.id))
    .where(eq(schema.employees.companyId, companyId))
    .orderBy(desc(schema.advances.status), desc(schema.advances.givenOn), desc(schema.advances.id));
  return attach(rows);
}

export async function advancesForEmployee(employeeId: number): Promise<AdvanceView[]> {
  const rows = await db
    .select({ advance: schema.advances, employee: schema.employees })
    .from(schema.advances)
    .innerJoin(schema.employees, eq(schema.advances.employeeId, schema.employees.id))
    .where(eq(schema.advances.employeeId, employeeId))
    .orderBy(desc(schema.advances.givenOn), desc(schema.advances.id));
  return attach(rows);
}

/** Active employees, for the "new advance" picker. */
export async function advanceCandidates(companyId: number) {
  return db
    .select({ id: schema.employees.id, name: schema.employees.name, code: schema.employees.code })
    .from(schema.employees)
    .where(and(eq(schema.employees.companyId, companyId), eq(schema.employees.status, "active")))
    .orderBy(asc(schema.employees.name));
}
