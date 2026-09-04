import { PageHeader } from "@/components/page-header";
import { getActiveCompany } from "@/lib/company";
import { longDate, shiftDate, to12h } from "@/lib/dates";

export default async function DashboardPage() {
  const company = await getActiveCompany();
  if (!company) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="rounded-2xl bg-white p-6 shadow-card">
          No company yet — run <code className="rounded bg-chalk px-1.5 py-0.5">npm run db:seed</code>{" "}
          or add one in Settings (Phase 2).
        </div>
      </>
    );
  }
  const today = shiftDate(new Date(), company);
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Shift date ${longDate(today)} — shift ${to12h(company.shiftStart)} to ${to12h(company.shiftEnd)}`}
      />
      <div className="grid grid-cols-4 gap-4">
        {[
          ["Checked in", "—"],
          ["Not yet in", "—"],
          ["Absent / unpaid leave", "—"],
          ["Advances outstanding", "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white px-5 py-5 shadow-card">
            <div className="text-[13px] font-medium text-navy-70">{label}</div>
            <div className="mt-2.5 text-[34px] font-medium leading-none tracking-tight">{value}</div>
            <div className="mt-2 text-xs text-navy-45">available after Phase 3</div>
          </div>
        ))}
      </div>
    </>
  );
}
