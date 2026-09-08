import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { requireActiveCompany } from "@/lib/company";
import { parseYmd } from "@/lib/dates";
import { fmtMoney, fmtRs } from "@/lib/money";
import { getPayslip, payslipSiblings } from "@/lib/payroll/payslip";
import { paidLeaveThisYear } from "@/lib/reports";
import { PrintButton } from "./print-button";

function d(ymd: string) {
  return format(parseYmd(ymd), "MMM d, yyyy");
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const company = await requireActiveCompany();
  const data = await getPayslip(Number(raw), company.id);
  if (!data) notFound();

  const { payslip: p, employee: e, run } = data;
  const ym = `${run.year}-${String(run.month).padStart(2, "0")}`;
  const monthLabel = format(new Date(run.year, run.month - 1, 1), "MMMM yyyy");
  const locked = run.status === "locked";

  const [siblings, leaveUsed] = await Promise.all([payslipSiblings(run.id), paidLeaveThisYear(e.id, ym)]);
  const index = siblings.findIndex((s) => s.id === p.id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const quota = e.leaveQuotaAnnual ?? company.defaultLeaveQuota;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Payslip"
          subtitle={
            <>
              {e.name} · {monthLabel} · <Tag variant={locked ? "locked" : "draft"}>{locked ? "Locked" : "Draft"}</Tag>
              {!locked && <span className="ml-2 text-navy-45">these numbers can still change until the month is locked</span>}
            </>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/payroll?month=${ym}`} />}>
                ‹ Payroll
              </Button>
              {prev && (
                <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/payslips/${prev.id}`} />}>
                  Previous
                </Button>
              )}
              {next && (
                <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/payslips/${next.id}`} />}>
                  Next
                </Button>
              )}
              <PrintButton />
            </div>
          }
        />
      </div>

      <article className="print-sheet mx-auto max-w-3xl rounded-2xl bg-white px-11 py-10 shadow-card">
        <header className="mb-5 flex items-start justify-between border-b-2 border-navy pb-4">
          <div>
            <div className="text-lg font-semibold">{company.name}</div>
            <div className="text-xs text-navy-70">Payslip · {monthLabel}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{e.name}</div>
            <div className="text-xs text-navy-70">
              {e.code}
              {e.designation ? ` · ${e.designation}` : ""}
              <br />
              Joined {d(e.joinDate)} · {p.wasOnProbation ? "Probation" : "Confirmed"}
              {e.exitDate && <> · exited {d(e.exitDate)}</>}
            </div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <Kv label="Monthly salary" value={fmtRs(p.monthlySalary, company.currency)} />
          <Kv label="Per-day rate" value={`${fmtRs(p.perDayRate, company.currency)} (÷ ${p.divisor})`} />
          <Kv label="Bank" value={e.bankName ? `${e.bankName}${e.accountNumber ? ` · ${e.accountNumber}` : ""}` : "—"} />
          <Kv label="Paid leave" value={`${leaveUsed} of ${quota} used this year`} />
        </dl>

        <Section title="Attendance" />
        <table className="w-full text-[13px]">
          <tbody>
            <Line label="Present" value={p.presentDays} />
            <Line label="Weekly off (paid)" value={p.weeklyOffDays} />
            <Line label="Public holiday (paid)" value={p.publicHolidayDays} />
            <Line label="Paid leave" value={p.leavePaidDays} />
            <Line label="Unpaid leave" value={p.leaveUnpaidDays} red={p.leaveUnpaidDays > 0} />
            <Line label="Absent" value={p.absentDays} red={p.absentDays > 0} />
            <Line label="Payable days" value={p.payableDays} strong />
          </tbody>
        </table>

        <Section title="Calculation" />
        <table className="w-full text-[13px]">
          <tbody>
            <Line
              label={
                <>
                  Base{" "}
                  <span className="text-navy-45">
                    {p.payableDays} day{p.payableDays === 1 ? "" : "s"}
                    {p.baseAmount === p.monthlySalary ? " — full month" : ` × ${fmtMoney(p.perDayRate)}, capped at the monthly salary`}
                  </span>
                </>
              }
              value={fmtMoney(p.baseAmount)}
            />
            {p.unpaidDays > 0 && (
              <Line
                label={
                  <>
                    Unpaid days <span className="text-navy-45">{p.unpaidDays} × {fmtMoney(p.perDayRate)}</span>
                  </>
                }
                value={`− ${fmtMoney(p.deductionAmount)}`}
                red
              />
            )}
            {p.advanceDeduction > 0 && (
              <Line
                label={
                  <>
                    Advance installment{" "}
                    <span className="text-navy-45">
                      {data.advances.length > 1 ? `${data.advances.length} advances` : `given ${d(data.advances[0]?.givenOn ?? e.joinDate)}`}
                    </span>
                  </>
                }
                value={`− ${fmtMoney(p.advanceDeduction)}`}
              />
            )}
            {p.otherAdditions > 0 && (
              <Line
                label={<>Other additions <span className="text-navy-45">{p.otherAdditionsNote}</span></>}
                value={`+ ${fmtMoney(p.otherAdditions)}`}
              />
            )}
            {p.otherDeductions > 0 && (
              <Line
                label={<>Other deductions <span className="text-navy-45">{p.otherDeductionsNote}</span></>}
                value={`− ${fmtMoney(p.otherDeductions)}`}
                red
              />
            )}
          </tbody>
        </table>

        <div className="mt-5 flex items-baseline justify-between border-t-2 border-navy pt-3.5 text-[15px] font-semibold">
          <span>Net payable</span>
          <span className="text-2xl">{fmtRs(p.netPayable, company.currency)}</span>
        </div>

        <footer className="mt-9 flex items-end justify-between text-xs text-navy-70">
          <div>
            Generated {format(new Date(run.generatedAt), "MMM d, yyyy")}
            {run.lockedAt && <> · Locked {format(new Date(run.lockedAt), "MMM d, yyyy")}</>}
            <br />
            {locked ? "Numbers are a snapshot and do not change after locking." : "Draft — not locked yet."}
          </div>
          <div className="w-44 border-t border-navy pt-1.5">Authorised signature</div>
        </footer>
      </article>
    </>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-navy-70">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <h3 className="mb-2 mt-6 text-[13px] font-medium uppercase tracking-wide text-navy-70">{title}</h3>;
}

function Line({
  label,
  value,
  red,
  strong,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  red?: boolean;
  strong?: boolean;
}) {
  return (
    <tr className="border-b border-navy-06 last:border-0">
      <td className={`py-1.5 ${red ? "text-red" : ""} ${strong ? "font-semibold" : ""}`}>{label}</td>
      <td className={`py-1.5 text-right ${red ? "text-red" : ""} ${strong ? "font-semibold" : ""}`}>{value}</td>
    </tr>
  );
}
