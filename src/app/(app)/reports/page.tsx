import Link from "next/link";
import { addMonths, format } from "date-fns";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getActiveCompany } from "@/lib/company";
import { parseYmd, todayIn } from "@/lib/dates";
import { fmtMoney, fmtRs } from "@/lib/money";
import { attendanceSummary, salaryRegister } from "@/lib/reports";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Reports" subtitle="Add a company first (Settings)." />;

  const { month: raw } = await searchParams;
  const today = todayIn(company.timezone);
  const ym = /^\d{4}-\d{2}$/.test(raw ?? "") ? (raw as string) : today.slice(0, 7);
  const first = parseYmd(`${ym}-01`);
  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");

  const [register, summary] = await Promise.all([salaryRegister(company.id, ym), attendanceSummary(company, ym)]);
  const total = register.reduce(
    (t, r) => ({
      base: t.base + r.baseAmount,
      deduction: t.deduction + r.deductionAmount,
      advance: t.advance + r.advanceDeduction,
      net: t.net + r.netPayable,
    }),
    { base: 0, deduction: 0, advance: 0, net: 0 },
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${company.name} · ${format(first, "MMMM yyyy")}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/reports?month=${prev}`} />}>
              ‹
            </Button>
            <div className="min-w-40 rounded-full bg-white px-4 py-2 text-center font-medium shadow-card">{format(first, "MMMM yyyy")}</div>
            <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/reports?month=${next}`} />}>
              ›
            </Button>
          </div>
        }
      />

      <Card className="mb-5">
        <CardHeader
          title="Monthly salary register"
          right={
            register.length > 0 && (
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/reports/register?month=${ym}&kind=register`} download />}>
                Export CSV
              </Button>
            )
          }
        />
        {register.length === 0 ? (
          <div className="px-5 py-10 text-center text-navy-45">
            No payroll for {format(first, "MMMM yyyy")} yet —{" "}
            <Link href={`/payroll?month=${ym}`} className="underline underline-offset-4">
              generate it
            </Link>{" "}
            first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-navy-45">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Designation</th>
                  <th className="px-3 py-3 text-right font-medium">Salary</th>
                  <th className="px-3 py-3 text-right font-medium">Unpaid</th>
                  <th className="px-3 py-3 text-right font-medium">Base</th>
                  <th className="px-3 py-3 text-right font-medium">Deduction</th>
                  <th className="px-3 py-3 text-right font-medium">Advance</th>
                  <th className="px-3 py-3 text-right font-medium">Net payable</th>
                  <th className="px-5 py-3 font-medium">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-06">
                {register.map((r) => (
                  <tr key={r.code}>
                    <td className="px-5 py-3">
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-2 text-xs text-navy-45">{r.code}</span>
                    </td>
                    <td className="px-3 py-3 text-navy-70">{r.designation ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{fmtMoney(r.monthlySalary)}</td>
                    <td className={`px-3 py-3 text-right ${r.unpaidDays > 0 ? "text-red" : "text-navy-45"}`}>{r.unpaidDays}</td>
                    <td className="px-3 py-3 text-right">{fmtMoney(r.baseAmount)}</td>
                    <td className={`px-3 py-3 text-right ${r.deductionAmount > 0 ? "text-red" : "text-navy-45"}`}>{fmtMoney(r.deductionAmount)}</td>
                    <td className="px-3 py-3 text-right">{fmtMoney(r.advanceDeduction)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmtMoney(r.netPayable)}</td>
                    <td className="px-5 py-3 text-xs text-navy-70">
                      {r.bankName ?? "—"}
                      {r.accountNumber && <div className="text-navy-45">{r.accountNumber}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-navy-12 bg-chalk font-semibold">
                  <td className="px-5 py-3" colSpan={4}>
                    Total · {register.length}
                  </td>
                  <td className="px-3 py-3 text-right">{fmtMoney(total.base)}</td>
                  <td className="px-3 py-3 text-right">{fmtMoney(total.deduction)}</td>
                  <td className="px-3 py-3 text-right">{fmtMoney(total.advance)}</td>
                  <td className="px-3 py-3 text-right">{fmtRs(total.net, company.currency)}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Attendance summary"
          right={
            summary.length > 0 && (
              <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/reports/register?month=${ym}&kind=attendance`} download />}>
                Export CSV
              </Button>
            )
          }
        />
        {summary.length === 0 ? (
          <div className="px-5 py-10 text-center text-navy-45">No employees in this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="text-left text-xs text-navy-45">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 text-right font-medium">Present</th>
                  <th className="px-3 py-3 text-right font-medium">Weekly off</th>
                  <th className="px-3 py-3 text-right font-medium">Holiday</th>
                  <th className="px-3 py-3 text-right font-medium">Paid leave</th>
                  <th className="px-3 py-3 text-right font-medium">Unpaid leave</th>
                  <th className="px-3 py-3 text-right font-medium">Absent</th>
                  <th className="px-3 py-3 text-right font-medium">Not marked</th>
                  <th className="px-3 py-3 text-right font-medium">Hand-typed</th>
                  <th className="px-5 py-3 text-right font-medium">No check-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-06">
                {summary.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="px-5 py-3">
                      <Link href={`/employees/${r.employeeId}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="ml-2 text-xs text-navy-45">{r.code}</span>
                    </td>
                    <td className="px-3 py-3 text-right">{r.present}</td>
                    <td className="px-3 py-3 text-right text-navy-70">{r.weeklyOff}</td>
                    <td className="px-3 py-3 text-right text-navy-70">{r.publicHoliday}</td>
                    <td className="px-3 py-3 text-right">{r.leavePaid}</td>
                    <td className={`px-3 py-3 text-right ${r.leaveUnpaid > 0 ? "text-red" : "text-navy-45"}`}>{r.leaveUnpaid}</td>
                    <td className={`px-3 py-3 text-right ${r.absent > 0 ? "text-red" : "text-navy-45"}`}>{r.absent}</td>
                    <td className="px-3 py-3 text-right text-navy-70">{r.notMarked || "—"}</td>
                    <td className="px-3 py-3 text-right text-navy-70">{r.byHand}</td>
                    <td className="px-5 py-3 text-right text-navy-70">{r.missingCheckOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-navy-45">
        The register comes from the payroll snapshot for the month; the attendance summary is read live off the grid, so
        it keeps moving until payroll is locked. <b className="font-medium">Not marked</b> counts working days still ahead
        of today — payroll turns them into absences once the month is over, which is why the two can disagree mid-month.
      </p>
    </>
  );
}
