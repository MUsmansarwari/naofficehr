import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** One payslip with everything the printable page needs, scoped to a company. */
export async function getPayslip(id: number, companyId: number) {
  const [row] = await db
    .select({
      payslip: schema.payslips,
      employee: schema.employees,
      run: schema.payrollRuns,
      company: schema.companies,
    })
    .from(schema.payslips)
    .innerJoin(schema.payrollRuns, eq(schema.payslips.payrollRunId, schema.payrollRuns.id))
    .innerJoin(schema.employees, eq(schema.payslips.employeeId, schema.employees.id))
    .innerJoin(schema.companies, eq(schema.payrollRuns.companyId, schema.companies.id))
    .where(and(eq(schema.payslips.id, id), eq(schema.payrollRuns.companyId, companyId)))
    .limit(1);
  if (!row) return null;

  const advances = await db
    .select({
      amount: schema.advanceInstallments.amount,
      advanceAmount: schema.advances.amount,
      givenOn: schema.advances.givenOn,
    })
    .from(schema.advanceInstallments)
    .innerJoin(schema.advances, eq(schema.advanceInstallments.advanceId, schema.advances.id))
    .where(
      and(
        eq(schema.advanceInstallments.payrollRunId, row.run.id),
        eq(schema.advances.employeeId, row.employee.id),
      ),
    );

  return { ...row, advances };
}

/** Neighbouring payslips in the same run, for prev/next navigation. */
export async function payslipSiblings(runId: number) {
  return db
    .select({ id: schema.payslips.id, name: schema.employees.name })
    .from(schema.payslips)
    .innerJoin(schema.employees, eq(schema.payslips.employeeId, schema.employees.id))
    .where(eq(schema.payslips.payrollRunId, runId))
    .orderBy(asc(schema.employees.name));
}
