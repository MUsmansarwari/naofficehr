import { format } from "date-fns";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { requireActiveCompany } from "@/lib/company";
import { parseYmd, todayIn } from "@/lib/dates";
import { currentSalary, employeeHistory, getEmployee, hasNoRecords, salaryHistory, stageOn } from "@/lib/employees";
import { fmtMoney, fmtRs } from "@/lib/money";
import { DetailsCard } from "./details-card";
import { SalaryDialog } from "./salary-dialog";
import { StatusActions } from "./status-actions";

function d(ymd: string) {
  return format(parseYmd(ymd), "MMM d, yyyy");
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  const company = await requireActiveCompany();
  const emp = await getEmployee(id);
  if (!emp || emp.companyId !== company.id) notFound();

  const [salary, history, audit, deletable] = await Promise.all([
    currentSalary(id),
    salaryHistory(id),
    employeeHistory(id),
    hasNoRecords(id),
  ]);
  const today = todayIn(company.timezone);
  const stage = stageOn(emp, today);

  return (
    <>
      <PageHeader
        title={
          <>
            {emp.name} <span className="ml-1 text-base font-normal text-navy-45">{emp.code}</span>
          </>
        }
        subtitle={
          <>
            {emp.designation ?? "—"} · Joined {d(emp.joinDate)} ·{" "}
            {emp.status === "active" ? (stage === "probation" ? "Probation" : "Confirmed") : emp.status}{" "}
            {emp.status === "active" && stage === "probation" && (
              <Tag variant="probation" className="ml-2">
                ends {d(emp.probationEndDate)}
              </Tag>
            )}
          </>
        }
        actions={<StatusActions employee={emp} deletable={deletable} />}
      />

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="grid content-start gap-4">
          <DetailsCard company={company} employee={emp} salary={salary} />

          <Card>
            <CardHeader title="Salary history" right={<SalaryDialog employeeId={emp.id} currency={company.currency} />} />
            <table className="w-full">
              <tbody className="divide-y divide-navy-06">
                {history.map((s, i) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-navy-70">Effective {d(s.effectiveFrom)}</td>
                    <td className="px-3 py-3 text-navy-45">{s.note ?? ""}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {fmtMoney(s.monthlySalary)}
                      {i === 0 && <span className="ml-2 text-xs font-normal text-navy-45">current</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="History" right={<span className="text-xs text-navy-45">audit log · newest first</span>} />
            <table className="w-full">
              <tbody className="divide-y divide-navy-06">
                {audit.length === 0 && (
                  <tr>
                    <td className="px-5 py-4 text-navy-45">Nothing yet.</td>
                  </tr>
                )}
                {audit.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="w-44 px-5 py-3 text-xs text-navy-45">{format(new Date(a.at), "MMM d, yyyy · h:mm a")}</td>
                    <td className="px-3 py-3">
                      <span className="font-medium capitalize">
                        {a.entityType.replace("_", " ")} {a.action}
                      </span>
                      {a.note && <div className="text-xs text-navy-70">{a.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardBody>
              <div className="text-[13px] font-medium text-navy-70">Current salary</div>
              <div className="mt-2 text-[28px] font-medium leading-none tracking-tight">
                {salary ? fmtRs(salary.monthlySalary, company.currency) : "—"}
              </div>
              {salary && (
                <div className="mt-2 text-xs text-navy-45">
                  per day {fmtMoney(Math.floor(salary.monthlySalary / company.salaryDivisor))} · ÷ {company.salaryDivisor}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="This year" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Paid leave quota" value={`${emp.leaveQuotaAnnual ?? company.defaultLeaveQuota}`} />
              <Row label="Paid leave used" value="— (Phase 3)" />
              <Row label="Unpaid leave" value="— (Phase 3)" />
              <Row label="Absent" value="— (Phase 3)" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Advances" />
            <CardBody className="text-navy-70">Phase 5.</CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-navy-70">{label}</span>
      <b className="font-medium">{value}</b>
    </div>
  );
}
