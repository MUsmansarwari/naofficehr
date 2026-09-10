import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import { getMonthGrid } from "@/lib/attendance/queries";
import { getActiveCompany } from "@/lib/company";
import { shiftDate } from "@/lib/dates";
import { AttendanceGrid } from "./grid";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Attendance" subtitle="Add a company first (Settings)." />;

  const { month: raw } = await searchParams;
  const today = shiftDate(new Date(), company);
  const ym = /^\d{4}-\d{2}$/.test(raw ?? "") ? (raw as string) : today.slice(0, 7);

  const grid = await getMonthGrid(company, ym);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={
          <>
            Columns are <b className="font-medium text-navy">shift dates</b> — a Friday column holds Friday night’s shift, including the early-morning Saturday check-out.
          </>
        }
        actions={
          <MonthNav path="/attendance" ym={ym} />
        }
      />
      <AttendanceGrid key={ym} company={{ timezone: company.timezone }} days={grid.days} rows={grid.rows} today={grid.today} />
    </>
  );
}
