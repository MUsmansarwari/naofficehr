import Link from "next/link";
import { format } from "date-fns";
import { Card } from "@/components/card";
import { FilterPills } from "@/components/filter-pills";
import { PendingLink } from "@/components/pending-link";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { getActiveCompany } from "@/lib/company";
import { parseYmd, todayIn } from "@/lib/dates";
import { listEmployees, stageOn } from "@/lib/employees";
import { fmtMoney } from "@/lib/money";

const FILTERS = [
  ["active", "Active"],
  ["exited", "Exited"],
  ["archived", "Archived"],
  ["all", "All"],
] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const company = await getActiveCompany();
  const { status: raw } = await searchParams;
  const status = (FILTERS.some(([k]) => k === raw) ? raw : "active") as (typeof FILTERS)[number][0];
  if (!company) return <PageHeader title="Employees" subtitle="Add a company first (Settings)." />;

  const rows = await listEmployees(company.id, { status });
  const today = todayIn(company.timezone);

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${rows.length} ${status === "all" ? "total" : status}`}
        actions={
          <Button render={<Link href="/employees/new" />} nativeButton={false} variant="secondary">
            Add employee
          </Button>
        }
      />
      <FilterPills
        current={status}
        items={FILTERS.map(([k, label]) => ({ key: k, label, href: k === "active" ? "/employees" : `/employees?status=${k}` }))}
      />

      <Card>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-navy-45">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 font-medium">Designation</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 text-right font-medium">Salary</th>
              <th className="px-5 py-3 text-right font-medium">PIN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-06">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-navy-45">
                  No {status === "all" ? "" : status} employees.
                </td>
              </tr>
            )}
            {rows.map((e) => {
              const stage = e.status === "active" ? stageOn(e, today) : null;
              return (
                <tr key={e.id} className="hover:bg-chalk/60">
                  <td className="px-5 py-3">
                    <PendingLink href={`/employees/${e.id}`} className="font-medium hover:underline">
                      {e.name}
                    </PendingLink>
                    <span className="ml-2 text-xs text-navy-45">{e.code}</span>
                  </td>
                  <td className="px-3 py-3 text-navy-70">{e.designation ?? "—"}</td>
                  <td className="px-3 py-3 text-navy-70">{format(parseYmd(e.joinDate), "MMM d, yyyy")}</td>
                  <td className="px-3 py-3">
                    {e.status !== "active" ? (
                      <Tag>{e.status}</Tag>
                    ) : stage === "probation" ? (
                      <Tag variant="probation">Probation · ends {format(parseYmd(e.probationEndDate), "MMM d")}</Tag>
                    ) : (
                      <span className="text-navy-70">Confirmed</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">{e.salary ? fmtMoney(e.salary.monthlySalary) : "—"}</td>
                  <td className="px-5 py-3 text-right text-navy-45">{e.checkinPin ? "••••" : "not set"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
