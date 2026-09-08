import Link from "next/link";
import { format } from "date-fns";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { getActiveCompany } from "@/lib/company";
import { advanceCandidates, listAdvances } from "@/lib/advances/queries";
import { monthLabel } from "@/lib/advances/schedule";
import { parseYmd } from "@/lib/dates";
import { fmtMoney, fmtRs } from "@/lib/money";
import { AdvanceActions } from "./advance-actions";
import { NewAdvanceDialog } from "./new-advance-dialog";

export default async function AdvancesPage() {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Advances" subtitle="Add a company first (Settings)." />;

  const [advances, candidates] = await Promise.all([listAdvances(company.id), advanceCandidates(company.id)]);
  const open = advances.filter((a) => a.advance.status !== "closed");
  const outstanding = open.reduce((s, a) => s + a.advance.remainingAmount, 0);
  const people = new Set(open.map((a) => a.advance.employeeId)).size;

  return (
    <>
      <PageHeader
        title="Advances"
        subtitle={
          open.length === 0
            ? "Nothing outstanding"
            : `${fmtRs(outstanding, company.currency)} outstanding across ${people} employee${people === 1 ? "" : "s"}`
        }
        actions={<NewAdvanceDialog candidates={candidates} currency={company.currency} />}
      />

      <Card>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-navy-45">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 font-medium">Given</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 text-right font-medium">Installment</th>
              <th className="px-3 py-3 font-medium">From</th>
              <th className="px-3 py-3 text-right font-medium">Taken</th>
              <th className="px-3 py-3 text-right font-medium">Remaining</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-06">
            {advances.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-navy-45">
                  No advances yet. Payroll deducts one installment a month from the start month, and the last one is
                  whatever is left.
                </td>
              </tr>
            )}
            {advances.map(({ advance, employee, taken, installments }) => {
              const closed = advance.status === "closed";
              return (
                <tr key={advance.id} className={closed ? "opacity-55" : undefined}>
                  <td className="px-5 py-3">
                    <Link href={`/employees/${employee.id}`} className="font-medium hover:underline">
                      {employee.name}
                    </Link>
                    <span className="ml-2 text-xs text-navy-45">{employee.code}</span>
                    {advance.reason && <div className="text-xs text-navy-45">{advance.reason}</div>}
                  </td>
                  <td className="px-3 py-3 text-navy-70">{format(parseYmd(advance.givenOn), "MMM d, yyyy")}</td>
                  <td className="px-3 py-3 text-right">{fmtMoney(advance.amount)}</td>
                  <td className="px-3 py-3 text-right">{fmtMoney(advance.installmentAmount)}</td>
                  <td className="px-3 py-3 text-navy-70">{monthLabel(advance.startMonth)}</td>
                  <td className="px-3 py-3 text-right text-navy-70">{fmtMoney(taken)}</td>
                  <td className="px-3 py-3 text-right font-medium">{fmtMoney(advance.remainingAmount)}</td>
                  <td className="px-3 py-3">
                    {closed ? (
                      <Tag>{advance.remainingAmount > 0 ? `Closed · ${fmtMoney(advance.remainingAmount)} waived` : "Closed"}</Tag>
                    ) : advance.status === "paused" ? (
                      <Tag variant="probation">Paused</Tag>
                    ) : (
                      <Tag variant="draft">Active</Tag>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <AdvanceActions advance={advance} employeeName={employee.name} installments={installments} currency={company.currency} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-navy-45">
        Balances move when a payroll month is <b className="font-medium">locked</b>, not when a draft is generated.
        Pausing skips the advance without changing the balance. Closing early leaves what is owed on the record as waived.
      </p>
    </>
  );
}
