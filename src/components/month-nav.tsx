import { addMonths, format } from "date-fns";
import { PendingLink } from "@/components/pending-link";
import { parseYmd } from "@/lib/dates";

const arrow = "size-9 rounded-[10px] bg-white text-navy shadow-card transition-colors hover:bg-chalk";

/** Previous / current / next month, shared by attendance, payroll and reports. */
export function MonthNav({ path, ym }: { path: string; ym: string }) {
  const first = parseYmd(`${ym}-01`);
  const prev = format(addMonths(first, -1), "yyyy-MM");
  const next = format(addMonths(first, 1), "yyyy-MM");
  return (
    <div className="flex items-center gap-2">
      <PendingLink href={`${path}?month=${prev}`} swap aria-label="Previous month" className={arrow}>
        ‹
      </PendingLink>
      <div className="min-w-40 rounded-full bg-white px-4 py-2 text-center font-medium shadow-card">
        {format(first, "MMMM yyyy")}
      </div>
      <PendingLink href={`${path}?month=${next}`} swap aria-label="Next month" className={arrow}>
        ›
      </PendingLink>
    </div>
  );
}
