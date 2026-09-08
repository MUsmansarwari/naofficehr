import Link from "next/link";
import { addMonths, format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getMonthGrid } from "@/lib/attendance/queries";
import { getActiveCompany } from "@/lib/company";
import { parseYmd, shiftDate } from "@/lib/dates";
import { AttendanceGrid } from "./grid";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Attendance" subtitle="Add a company first (Settings)." />;

  const { month: raw } = await searchParams;
  const today = shiftDate(new Date(), company);
  const ym = /^\d{4}-\d{2}$/.test(raw ?? "") ? (raw as string) : today.slice(0, 7);
  const first = parseYmd(`${ym}-01`);
  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/attendance?month=${prev}`} />}>
              ‹
            </Button>
            <div className="min-w-40 rounded-full bg-white px-4 py-2 text-center font-medium shadow-card">{format(first, "MMMM yyyy")}</div>
            <Button variant="outline" size="sm" className="border-0 bg-white shadow-card" nativeButton={false} render={<Link href={`/attendance?month=${next}`} />}>
              ›
            </Button>
          </div>
        }
      />
      <AttendanceGrid key={ym} company={{ timezone: company.timezone }} days={grid.days} rows={grid.rows} today={grid.today} />
    </>
  );
}
