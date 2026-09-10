import { format } from "date-fns";
import { and, asc, eq, like } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, CardHeader } from "@/components/card";
import { FilterPills } from "@/components/filter-pills";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/tag";
import { getActiveCompany } from "@/lib/company";
import { parseYmd, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AddHolidayForm } from "./add-holiday-form";
import { HolidayRowActions } from "./holiday-row-actions";
import { ImportPresets } from "./import-presets";

const SOURCE_LABEL = { us_federal: "USA federal", pakistan: "Pakistan", custom: "Custom" } as const;

export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const company = await getActiveCompany();
  if (!company) return <PageHeader title="Holidays" subtitle="Add a company first (Settings)." />;

  const thisYear = Number(todayIn(company.timezone).slice(0, 4));
  const { year: rawYear } = await searchParams;
  const year = /^\d{4}$/.test(rawYear ?? "") ? Number(rawYear) : thisYear;
  const years = [thisYear - 1, thisYear, thisYear + 1];

  const rows = await db
    .select()
    .from(schema.holidays)
    .where(and(eq(schema.holidays.companyId, company.id), like(schema.holidays.date, `${year}-%`)))
    .orderBy(asc(schema.holidays.date));
  const active = rows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        title="Holidays"
        subtitle={`${company.name} · ${active} paid holiday${active === 1 ? "" : "s"} in ${year}`}
        actions={<ImportPresets year={year} />}
      />
      <FilterPills
        current={String(year)}
        items={years.map((y) => ({ key: String(y), label: String(y), href: `/holidays?year=${y}` }))}
      />

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Card>
          <CardHeader title={`${year}`} right={<span className="text-xs text-navy-45">Weekly offs are handled separately — a holiday on a weekly off stays a weekly off</span>} />
          <table className="w-full">
            <tbody className="divide-y divide-navy-06">
              {rows.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-navy-45">No holidays for {year}. Import a preset or add one.</td>
                </tr>
              )}
              {rows.map((h) => {
                const dt = parseYmd(h.date);
                const onWeeklyOff = company.weeklyOffs.includes(dt.getDay());
                return (
                  <tr key={h.id} className={cn(!h.isActive && "opacity-45")}>
                    <td className="w-40 px-5 py-3 font-medium">{format(dt, "EEE, MMM d")}</td>
                    <td className="px-3 py-3">
                      {h.name}
                      {onWeeklyOff && h.isActive && <span className="ml-2 text-xs text-navy-45">falls on weekly off</span>}
                      {!h.isActive && <span className="ml-2 text-xs">removed</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Tag>{SOURCE_LABEL[h.source]}</Tag>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <HolidayRowActions holiday={h} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Add holiday" />
            <AddHolidayForm year={year} />
          </Card>
          <Card>
            <CardHeader title="About presets" />
            <div className="space-y-2 px-5 py-4 text-[13px] text-navy-70">
              <p>
                <b className="font-medium text-navy">USA federal</b> — 11 holidays with the observed rule (Sat → Fri, Sun → Mon).
              </p>
              <p>
                <b className="font-medium text-navy">Pakistan</b> — 6 fixed-date gazetted holidays. Eid ul-Fitr, Eid ul-Adha, Ashura and
                Eid Milad follow the moon: add them manually once announced.
              </p>
              <p>Importing again never duplicates or overwrites a renamed holiday.</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
