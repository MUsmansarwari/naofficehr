import Link from "next/link";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db";
import { getActiveCompany } from "@/lib/company";
import { dashboardData } from "@/lib/dashboard";
import { formatLocal, longDate, parseYmd, to12h } from "@/lib/dates";
import { fmtRs } from "@/lib/money";

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  future: "Not yet in",
  absent: "Absent",
  leave_paid: "Paid leave",
  leave_unpaid: "Unpaid leave",
  weekly_off: "Weekly off",
  public_holiday: "Holiday",
  skip: "—",
};

export default async function DashboardPage() {
  const company = await getActiveCompany();
  if (!company) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <CardBody className="text-navy-70">
            No company yet — add one in{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </CardBody>
        </Card>
      </>
    );
  }

  const [data, settingsRow] = await Promise.all([
    dashboardData(company),
    db.select().from(schema.settings).limit(1),
  ]);
  const { counts, health, payroll } = data;
  const lastBackupAt = settingsRow[0]?.lastBackupAt ?? null;
  const backupAgeDays = lastBackupAt ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86_400_000) : null;
  const backupStale = backupAgeDays === null || backupAgeDays > 30;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            Shift date {longDate(data.today)} — shift {to12h(company.shiftStart)} to {to12h(company.shiftEnd)}
            {data.dayLabel && <Tag className="ml-2">{data.dayLabel}</Tag>}
          </>
        }
        actions={
          <Button variant="secondary" nativeButton={false} render={<a href="/api/backup" download />}>
            Download backup
          </Button>
        }
      />

      {backupStale && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-amber-12 px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-amber" />
          <span>
            {lastBackupAt ? (
              <>
                Your last backup is <b className="font-medium">{backupAgeDays} days old</b>. Download a fresh one.
              </>
            ) : (
              <>
                You have <b className="font-medium">never taken a backup</b>. One click, one JSON file — keep it somewhere safe.
              </>
            )}
          </span>
          <a href="/api/backup" download className="ml-auto shrink-0 underline underline-offset-4">
            Download now
          </a>
        </div>
      )}

      <div className="mb-4 grid grid-cols-4 gap-4">
        <Stat label="Checked in" value={counts.checkedIn} hint={`of ${counts.active} active`} />
        <Stat
          label="Not yet in"
          value={counts.notYetIn}
          hint={data.dayLabel ? data.dayLabel.toLowerCase() : `shift starts ${to12h(company.shiftStart)}`}
        />
        <Stat label="Absent / unpaid leave" value={counts.offToday} hint="marked today" red={counts.offToday > 0} />
        <Stat
          label="Advances outstanding"
          value={fmtRs(counts.advancesOutstanding, company.currency)}
          hint={`${counts.advancePeople} employee${counts.advancePeople === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Card>
          <CardHeader
            title="Tonight"
            right={
              <Link href={`/attendance?month=${data.ym}`} className="text-xs text-navy-45 hover:underline">
                Open attendance grid →
              </Link>
            }
          />
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-navy-45">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-3 py-3 font-medium">In</th>
                <th className="px-3 py-3 font-medium">Out</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-06">
              {data.tonight.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-navy-45">
                    No active employees yet.
                  </td>
                </tr>
              )}
              {data.tonight.map((t) => {
                const off = t.status === "absent" || t.status === "leave_unpaid";
                return (
                  <tr key={t.id}>
                    <td className="px-5 py-3">
                      <Link href={`/employees/${t.id}`} className="font-medium hover:underline">
                        {t.name}
                      </Link>
                      <span className="ml-2 text-xs text-navy-45">{t.code}</span>
                      {t.onProbation && (
                        <Tag variant="probation" className="ml-2">
                          Probation
                        </Tag>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {t.checkInAt ? (
                        <>
                          {formatLocal(t.checkInAt, company.timezone)}
                          {t.byHand && <span className="ml-1 inline-block size-1.5 rounded-full bg-amber align-middle" title="typed by hand" />}
                        </>
                      ) : (
                        <span className="text-navy-45">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {t.checkOutAt ? formatLocal(t.checkOutAt, company.timezone) : <span className="text-navy-45">—</span>}
                    </td>
                    <td className={`px-5 py-3 ${off ? "text-red" : t.status === "future" ? "text-navy-45" : ""}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Probation ending soon" />
            {data.probationSoon.length === 0 ? (
              <CardBody className="text-navy-70">Nobody in the next 30 days.</CardBody>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-navy-06">
                  {data.probationSoon.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <Link href={`/employees/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right">{format(parseYmd(p.endDate), "MMM d")}</td>
                      <td className="px-5 py-3 text-right text-navy-45">
                        {p.days === 0 ? "today" : `${p.days} day${p.days === 1 ? "" : "s"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <CardHeader title="Check-in page health" />
            <CardBody className="space-y-1.5 text-sm">
              <Row label="Failed PIN attempts (24h)" value={health.failedPins} red={health.failedPins > 20} />
              <Row label="Hand-typed times this month" value={health.byHand} />
              <Row label="Missing check-outs" value={health.missingCheckOut} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payroll" />
            <CardBody className="space-y-2 text-sm">
              {payroll.lastMonth !== null || payroll.thisMonth !== null ? (
                <>
                  {payroll.lastMonth && (
                    <RunLine
                      label={format(new Date(payroll.lastMonth.year, payroll.lastMonth.month - 1, 1), "MMMM yyyy")}
                      status={payroll.lastMonth.status}
                    />
                  )}
                  <RunLine
                    label={format(parseYmd(`${data.ym}-01`), "MMMM yyyy")}
                    status={payroll.thisMonth?.status ?? null}
                  />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-navy-70">{format(parseYmd(`${data.ym}-01`), "MMMM yyyy")}</span>
                  <Link href={`/payroll?month=${data.ym}`} className="underline underline-offset-4">
                    Not generated
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint, red }: { label: string; value: React.ReactNode; hint: string; red?: boolean }) {
  return (
    <Card className="px-5 py-5">
      <div className="text-[13px] font-medium text-navy-70">{label}</div>
      <div className={`mt-2.5 text-[34px] font-medium leading-none tracking-tight ${red ? "text-red" : ""}`}>{value}</div>
      <div className="mt-2 text-xs text-navy-45">{hint}</div>
    </Card>
  );
}

function Row({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-navy-70">{label}</span>
      <b className={`font-medium ${red ? "text-red" : ""}`}>{value}</b>
    </div>
  );
}

function RunLine({ label, status }: { label: string; status: "draft" | "locked" | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-navy-70">{label}</span>
      {status === "locked" ? (
        <Tag variant="locked">Locked</Tag>
      ) : status === "draft" ? (
        <Tag variant="draft">Draft</Tag>
      ) : (
        <span className="text-navy-45">Not generated</span>
      )}
    </div>
  );
}
