import Link from "next/link";
import { format } from "date-fns";
import { Card } from "@/components/card";
import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { getActiveCompany } from "@/lib/company";
import { parseYmd, todayIn } from "@/lib/dates";
import { fmtMoney, fmtRs } from "@/lib/money";
import { getRun, monthWarnings } from "@/lib/payroll/generate";
import { RunActions } from "./run-actions";
import { ReviewTable } from "./review-table";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Payroll" subtitle="Add a company first (Settings)." />;

  const { month: raw } = await searchParams;
  const today = todayIn(company.timezone);
  const ym = /^\d{4}-\d{2}$/.test(raw ?? "") ? (raw as string) : today.slice(0, 7);
  const first = parseYmd(`${ym}-01`);
  const monthIncomplete = ym >= today.slice(0, 7);

  const [view, warnings] = await Promise.all([getRun(company.id, ym), monthWarnings(company.id, ym)]);
  const rows = view?.rows ?? [];
  const locked = view?.run.status === "locked";

  const total = rows.reduce(
    (t, { payslip: p }) => ({
      base: t.base + p.baseAmount,
      deduction: t.deduction + p.deductionAmount,
      advance: t.advance + p.advanceDeduction,
      additions: t.additions + p.otherAdditions,
      deductions: t.deductions + p.otherDeductions,
      net: t.net + p.netPayable,
      payableDays: t.payableDays + p.payableDays,
      unpaidDays: t.unpaidDays + p.unpaidDays,
    }),
    { base: 0, deduction: 0, advance: 0, additions: 0, deductions: 0, net: 0, payableDays: 0, unpaidDays: 0 },
  );

  return (
    <>
      <PageHeader
        title={
          <>
            Payroll — {format(first, "MMMM yyyy")}{" "}
            {view && <Tag variant={locked ? "locked" : "draft"}>{locked ? "Locked" : "Draft"}</Tag>}
          </>
        }
        subtitle={
          view ? (
            <>
              {locked
                ? `Locked ${format(new Date(view.run.lockedAt ?? view.run.generatedAt), "MMM d, yyyy · h:mm a")}`
                : `Generated ${format(new Date(view.run.generatedAt), "MMM d, yyyy · h:mm a")}`}{" "}
              · divisor {view.run.divisorUsed} · {rows.length} employee{rows.length === 1 ? "" : "s"}
              {view.run.unlockReason && !locked && <> · unlocked: {view.run.unlockReason}</>}
            </>
          ) : (
            "Not generated yet"
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <MonthNav path="/payroll" ym={ym} />
            <RunActions ym={ym} exists={!!view} locked={locked} />
          </div>
        }
      />

      {monthIncomplete && !locked && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-amber-12 px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-amber" />
          <span>
            This month is not over. Days with no attendance yet count as <b className="font-medium">absent</b> — generate again once the month closes.
          </span>
        </div>
      )}

      {view && (warnings.byHand > 0 || warnings.missingCheckOut > 0) && !locked && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-amber-12 px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-amber" />
          <span>
            {warnings.byHand > 0 && <b className="font-medium">{warnings.byHand} hand-typed time{warnings.byHand === 1 ? "" : "s"}</b>}
            {warnings.byHand > 0 && warnings.missingCheckOut > 0 && " and "}
            {warnings.missingCheckOut > 0 && (
              <b className="font-medium">
                {warnings.missingCheckOut} missing check-out{warnings.missingCheckOut === 1 ? "" : "s"}
              </b>
            )}{" "}
            this month. Review the grid before locking — locked numbers never recompute.
          </span>
          <Link href={`/attendance?month=${ym}`} className="ml-auto shrink-0 underline underline-offset-4">
            Open grid
          </Link>
        </div>
      )}

      {!view ? (
        <Card className="px-6 py-10 text-center text-navy-70">
          No payroll for {format(first, "MMMM yyyy")} yet. Generating reads attendance, holidays, salaries and advances for the month.
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap gap-9 border-b border-navy-06 px-5 py-4">
            <Figure label="Gross base" value={fmtRs(total.base, company.currency)} />
            <Figure label="Deductions" value={fmtRs(total.deduction, company.currency)} tone="red" />
            <Figure label="Advances" value={fmtRs(total.advance, company.currency)} />
            <Figure label="Manual adj." value={`${total.additions - total.deductions >= 0 ? "+" : "−"} ${fmtMoney(Math.abs(total.additions - total.deductions))}`} />
            <Figure label="Net payable" value={fmtRs(total.net, company.currency)} strong />
          </div>
          <ReviewTable rows={rows} locked={locked} total={total} />
        </Card>
      )}

      {view && !locked && (
        <p className="mt-3 text-xs text-navy-45">
          Additions and deductions need a note. Locking writes a snapshot of every number above and reduces advance balances — after that nothing recomputes.
        </p>
      )}
    </>
  );
}

function Figure({ label, value, tone, strong }: { label: string; value: string; tone?: "red"; strong?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-navy-45">{label}</div>
      <div className={`${strong ? "font-semibold" : ""} ${tone === "red" ? "text-red" : ""} text-[15px]`}>{value}</div>
    </div>
  );
}
