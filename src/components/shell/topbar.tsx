import { formatInTimeZone } from "date-fns-tz";
import type { Company } from "@/db/schema";
import { logout } from "@/lib/actions/session";
import { Button } from "@/components/ui/button";
import { CompanySwitcher } from "./company-switcher";

export function Topbar({ companies, active }: { companies: Company[]; active: Company | null }) {
  const tz = active?.timezone ?? "Asia/Karachi";
  const now = formatInTimeZone(new Date(), tz, "EEEE, MMM d, yyyy · h:mm a");
  return (
    <header className="no-print sticky top-0 z-10 flex items-center gap-4 bg-chalk px-8 pb-1 pt-5">
      <CompanySwitcher companies={companies} activeId={active?.id ?? null} />
      <div className="text-navy-70">{now}</div>
      <div className="flex-1" />
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm" className="border-0 bg-white shadow-card">
          Log out
        </Button>
      </form>
    </header>
  );
}
